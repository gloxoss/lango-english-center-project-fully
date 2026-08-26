import { db } from '@/libs/DB';
import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import { attachmentTypes, digitalAssets, digitalAssetTargets, digitalAssetUsageLinks } from '@/features/attachments/models/attachments-schema';
import { isAssetVisibleToUser } from '@/features/attachments/services/targeting-service';
import {
  assessmentDefinitions,
  assessmentAudiences,
  homeworkDetails,
  homeworkAttempts,
  homeworkAttemptFiles,
  homeworkRubrics,
  homeworkRubricCriteria,
} from '../models/assessment-schema';
import { classes, classSubjects, subjects, user } from '@/models/Schema';
import { OutcomeService } from './outcome-service';
import { eq, and, inArray, desc, asc } from 'drizzle-orm';

type AudienceRow = { studentId: string | null; sectionId: string | null; classOfferingId: string | null };

// Real, independently-testable audience-matching rule (future-implementation
// /assessment-and-examination remediation, section-05) - a homework with no
// audience rows is a broadcast to everyone; one with audience rows is only
// visible if it targets this student directly, their section, or a
// class-offering their class participates in. Extracted so the exact rule
// used by getHomeworkForStudent below can be unit-tested without a live DB.
export function isHomeworkVisibleToStudent(
  audiences: AudienceRow[],
  student: { studentId: string; sectionId: string | null; offeringIds: string[] },
): boolean {
  if (audiences.length === 0) {
    return true;
  }
  return audiences.some(a =>
    a.studentId === student.studentId
    || (student.sectionId !== null && a.sectionId === student.sectionId)
    || (a.classOfferingId !== null && student.offeringIds.includes(a.classOfferingId)),
  );
}

export class HomeworkService {
  /**
   * Create a new homework definition with instructions, audience scoping, and late policies.
   */
  static async createHomework(params: {
    tenantId: string;
    classSubjectId?: string;
    sessionYearId?: string;
    termId?: string;
    title: string;
    description?: string;
    instructions?: string;
    maximumScore?: number;
    coefficient?: number;
    allowAttachments?: boolean;
    maxAttachments?: number;
    lateSubmissionPolicy?: 'reject' | 'accept_flag' | 'deduct_percentage';
    closeAt?: string;
    classOfferingIds?: string[];
    sectionIds?: string[];
    studentIds?: string[];
    createdBy: string;
  }) {
    const {
      tenantId,
      classSubjectId,
      sessionYearId,
      termId,
      title,
      description,
      instructions,
      maximumScore = 20,
      coefficient = 1,
      allowAttachments = true,
      maxAttachments = 3,
      lateSubmissionPolicy = 'accept_flag',
      closeAt,
      classOfferingIds = [],
      sectionIds = [],
      studentIds = [],
      createdBy,
    } = params;

    // 1. Create Core Assessment Definition
    const [def] = await db
      .insert(assessmentDefinitions)
      .values({
        tenantId,
        classSubjectId,
        sessionYearId,
        termId,
        type: 'homework',
        title,
        description,
        maximumScore: String(maximumScore),
        coefficient: String(coefficient),
        status: 'published',
        createdBy,
      })
      .returning();

    if (!def) {
      throw new Error('Failed to create homework assessment definition.');
    }

    // 2. Create Homework Details
    await db.insert(homeworkDetails).values({
      assessmentDefinitionId: def.id,
      instructions,
      allowAttachments,
      maxAttachments,
      lateSubmissionPolicy,
      closeAt,
    });

    // 3. Create Audience Scope Rows
    const audienceRows: Array<{
      assessmentDefinitionId: string;
      classOfferingId?: string;
      sectionId?: string;
      studentId?: string;
    }> = [];

    const defId = def.id;
    classOfferingIds.forEach((co) => audienceRows.push({ assessmentDefinitionId: defId, classOfferingId: co }));
    sectionIds.forEach((sec) => audienceRows.push({ assessmentDefinitionId: defId, sectionId: sec }));
    studentIds.forEach((st) => audienceRows.push({ assessmentDefinitionId: defId, studentId: st }));

    if (audienceRows.length > 0) {
      await db.insert(assessmentAudiences).values(audienceRows);
    }

    return def;
  }

  /**
   * Get role-scoped homework list for a student. Real audience matching
   * (future-implementation/assessment-and-examination remediation,
   * section-02) - previously returned every published homework in the
   * tenant to every student, ignoring assessmentAudiences entirely. A
   * homework with zero audience rows is a broadcast to the whole tenant
   * (unchanged, matches prior behavior for that case); a homework with
   * audience rows is now only visible if it targets this student directly,
   * their section, or a class-offering their class participates in.
   */
  static async getHomeworkForStudent(tenantId: string, studentId: string) {
    const { sectionId: mySectionId, offeringIds: myOfferingIds, classSubjectIds: myClassSubjectIds } = await resolveStudentAudienceContext(studentId);

    const homeworks = await db
      .select({
        id: assessmentDefinitions.id,
        title: assessmentDefinitions.title,
        description: assessmentDefinitions.description,
        maximumScore: assessmentDefinitions.maximumScore,
        status: assessmentDefinitions.status,
        createdAt: assessmentDefinitions.createdAt,
        instructions: homeworkDetails.instructions,
        allowAttachments: homeworkDetails.allowAttachments,
        closeAt: homeworkDetails.closeAt,
        latePolicy: homeworkDetails.lateSubmissionPolicy,
      })
      .from(assessmentDefinitions)
      .innerJoin(homeworkDetails, eq(assessmentDefinitions.id, homeworkDetails.assessmentDefinitionId))
      .where(
        and(
          eq(assessmentDefinitions.tenantId, tenantId),
          eq(assessmentDefinitions.type, 'homework'),
          eq(assessmentDefinitions.status, 'published')
        )
      )
      .orderBy(desc(assessmentDefinitions.createdAt));

    const allAudiences = homeworks.length > 0
      ? await db.select().from(assessmentAudiences).where(inArray(assessmentAudiences.assessmentDefinitionId, homeworks.map(hw => hw.id)))
      : [];
    const audiencesByHomework = new Map<string, typeof allAudiences>();
    for (const row of allAudiences) {
      const list = audiencesByHomework.get(row.assessmentDefinitionId) ?? [];
      list.push(row);
      audiencesByHomework.set(row.assessmentDefinitionId, list);
    }

    const visibleHomeworks = homeworks.filter(hw =>
      isHomeworkVisibleToStudent(audiencesByHomework.get(hw.id) ?? [], { studentId, sectionId: mySectionId, offeringIds: myOfferingIds }),
    );

    const attempts = await db
      .select()
      .from(homeworkAttempts)
      .where(eq(homeworkAttempts.studentId, studentId));

    const attemptsMap = new Map(attempts.map((a) => [a.assessmentDefinitionId, a]));

    const usageLinks = visibleHomeworks.length > 0
      ? await db.select().from(digitalAssetUsageLinks).where(and(eq(digitalAssetUsageLinks.usageType, 'homework'), inArray(digitalAssetUsageLinks.usageRefId, visibleHomeworks.map(hw => hw.id))))
      : [];
    const linkedAssetIds = usageLinks.map(l => l.assetId);
    const linkedAssets = linkedAssetIds.length > 0
      ? await db.select().from(digitalAssets).where(and(inArray(digitalAssets.id, linkedAssetIds), eq(digitalAssets.status, 'published')))
      : [];
    const assetById = new Map(linkedAssets.map(a => [a.id, a]));
    const assetTargets = linkedAssetIds.length > 0
      ? await db.select().from(digitalAssetTargets).where(inArray(digitalAssetTargets.assetId, linkedAssetIds))
      : [];
    const targetsByAsset = new Map<string, typeof assetTargets>();
    for (const t of assetTargets) {
      const list = targetsByAsset.get(t.assetId) ?? [];
      list.push(t);
      targetsByAsset.set(t.assetId, list);
    }
    const assetTypeIds = linkedAssets.map(a => a.attachmentTypeId);
    const assetTypes = assetTypeIds.length > 0
      ? await db.select().from(attachmentTypes).where(inArray(attachmentTypes.id, assetTypeIds))
      : [];
    const typeById = new Map(assetTypes.map(t => [t.id, t]));
    const viewer = { userId: studentId, role: 'student', sectionId: mySectionId, offeringIds: myOfferingIds, classSubjectIds: myClassSubjectIds };

    const linksByHomework = new Map<string, typeof linkedAssets>();
    for (const link of usageLinks) {
      const asset = assetById.get(link.assetId);
      if (!asset) continue;
      const type = typeById.get(asset.attachmentTypeId);
      if (!isAssetVisibleToUser(targetsByAsset.get(asset.id) ?? [], type?.studentVisible ?? true, viewer)) continue;
      const list = linksByHomework.get(link.usageRefId) ?? [];
      list.push(asset);
      linksByHomework.set(link.usageRefId, list);
    }

    return visibleHomeworks.map((hw) => ({
      ...hw,
      submission: attemptsMap.get(hw.id) || null,
      linkedResources: linksByHomework.get(hw.id) ?? [],
    }));
  }

  /**
   * Teacher/admin hub list: every homework in the tenant with subject/class
   * labels resolved and per-homework submission counts. Unlike the
   * student-scoped list this is not filtered by audience - a teacher grades
   * whatever was assigned regardless of who saw it - but it is still
   * hard-isolated to the tenant (the caller already ran requireRequestContext
   * + requireTenant).
   */
  static async listHomeworkForTeacher(tenantId: string) {
    const rows = await db
      .select({
        id: assessmentDefinitions.id,
        title: assessmentDefinitions.title,
        description: assessmentDefinitions.description,
        maximumScore: assessmentDefinitions.maximumScore,
        coefficient: assessmentDefinitions.coefficient,
        status: assessmentDefinitions.status,
        createdAt: assessmentDefinitions.createdAt,
        createdBy: assessmentDefinitions.createdBy,
        subjectName: subjects.name,
        className: classes.name,
        instructions: homeworkDetails.instructions,
        allowAttachments: homeworkDetails.allowAttachments,
        closeAt: homeworkDetails.closeAt,
      })
      .from(assessmentDefinitions)
      .innerJoin(homeworkDetails, eq(assessmentDefinitions.id, homeworkDetails.assessmentDefinitionId))
      .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(classes, eq(classSubjects.classId, classes.id))
      .where(
        and(
          eq(assessmentDefinitions.tenantId, tenantId),
          eq(assessmentDefinitions.type, 'homework'),
        )
      )
      .orderBy(desc(assessmentDefinitions.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const attemptRows = await db
      .select({
        assessmentDefinitionId: homeworkAttempts.assessmentDefinitionId,
        status: homeworkAttempts.status,
      })
      .from(homeworkAttempts)
      .where(inArray(homeworkAttempts.assessmentDefinitionId, rows.map(r => r.id)));

    const counts = new Map<string, { submitted: number; graded: number }>();
    for (const attempt of attemptRows) {
      const current = counts.get(attempt.assessmentDefinitionId) ?? { submitted: 0, graded: 0 };
      current.submitted += 1;
      if (attempt.status === 'graded') {
        current.graded += 1;
      }
      counts.set(attempt.assessmentDefinitionId, current);
    }

    return rows.map(row => ({
      ...row,
      subjectName: row.subjectName ?? null,
      className: row.className ?? null,
      submittedCount: counts.get(row.id)?.submitted ?? 0,
      gradedCount: counts.get(row.id)?.graded ?? 0,
    }));
  }

  /**
   * Roster of submissions (attempts) for one homework, joined with the
   * student's name/matricule for the correction inbox. Tenant-isolated through
   * the user join; the caller already ran requireRequestContext + requireTenant.
   */
  static async listHomeworkAttempts(tenantId: string, assessmentDefinitionId: string) {
    const rows = await db
      .select({
        id: homeworkAttempts.id,
        attemptNumber: homeworkAttempts.attemptNumber,
        studentId: homeworkAttempts.studentId,
        studentName: user.name,
        matricule: user.matricule,
        responseText: homeworkAttempts.responseText,
        submittedAt: homeworkAttempts.submittedAt,
        isLate: homeworkAttempts.isLate,
        status: homeworkAttempts.status,
        score: homeworkAttempts.score,
        feedbackText: homeworkAttempts.feedbackText,
      })
      .from(homeworkAttempts)
      .innerJoin(user, eq(homeworkAttempts.studentId, user.id))
      .where(and(
        eq(homeworkAttempts.assessmentDefinitionId, assessmentDefinitionId),
        eq(user.tenantId, tenantId),
      ))
      .orderBy(asc(homeworkAttempts.submittedAt));

    return rows;
  }

  /**
   * Submit homework attempt with file attachments.
   */
  static async submitHomeworkAttempt(params: {
    tenantId: string;
    assessmentDefinitionId: string;
    studentId: string;
    responseText?: string;
    files?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
  }) {
    const { tenantId, assessmentDefinitionId, studentId, responseText, files = [] } = params;

    const [definition] = await db
      .select({ id: assessmentDefinitions.id })
      .from(assessmentDefinitions)
      .where(and(eq(assessmentDefinitions.id, assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId)))
      .limit(1);

    if (!definition) {
      throw new Error('Homework record not found.');
    }

    const [details] = await db
      .select()
      .from(homeworkDetails)
      .where(eq(homeworkDetails.assessmentDefinitionId, assessmentDefinitionId))
      .limit(1);

    if (!details) {
      throw new Error('Homework record not found.');
    }

    const now = new Date();
    const isLate = details.closeAt ? now > new Date(details.closeAt) : false;

    if (isLate && details.lateSubmissionPolicy === 'reject') {
      throw new Error('Submission deadline has passed and late submissions are rejected.');
    }

    const existingAttempts = await db
      .select()
      .from(homeworkAttempts)
      .where(
        and(
          eq(homeworkAttempts.assessmentDefinitionId, assessmentDefinitionId),
          eq(homeworkAttempts.studentId, studentId)
        )
      );

    const nextAttemptNumber = existingAttempts.length + 1;

    const [attempt] = await db
      .insert(homeworkAttempts)
      .values({
        assessmentDefinitionId,
        studentId,
        attemptNumber: nextAttemptNumber,
        responseText,
        isLate,
        status: 'submitted',
      })
      .returning();

    if (!attempt) {
      throw new Error('Failed to record homework attempt.');
    }

    if (files.length > 0) {
      await db.insert(homeworkAttemptFiles).values(
        files.map((f) => ({
          attemptId: attempt.id,
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
        }))
      );
    }

    return attempt;
  }

  /**
   * Grade a homework submission and post result to shared core ledger.
   */
  static async gradeHomeworkAttempt(params: {
    tenantId: string;
    attemptId: string;
    score: number;
    feedbackText?: string;
    gradedBy: string;
  }) {
    const { tenantId, attemptId, score, feedbackText, gradedBy } = params;

    const [attempt] = await db
      .select({ id: homeworkAttempts.id, assessmentDefinitionId: homeworkAttempts.assessmentDefinitionId, studentId: homeworkAttempts.studentId })
      .from(homeworkAttempts)
      .innerJoin(assessmentDefinitions, eq(homeworkAttempts.assessmentDefinitionId, assessmentDefinitions.id))
      .where(and(eq(homeworkAttempts.id, attemptId), eq(assessmentDefinitions.tenantId, tenantId)))
      .limit(1);

    if (!attempt) {
      throw new Error('Homework attempt not found.');
    }

    const [updatedAttempt] = await db
      .update(homeworkAttempts)
      .set({
        score: String(score),
        feedbackText,
        status: 'graded',
        gradedBy,
        gradedAt: new Date().toISOString(),
      })
      .where(eq(homeworkAttempts.id, attemptId))
      .returning();

    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: attempt.assessmentDefinitionId,
      studentId: attempt.studentId,
      rawScore: score,
      status: 'graded',
      sourceType: 'homework_submission',
      sourceReferenceId: attemptId,
      markerId: gradedBy,
      reason: 'Homework submission graded by teacher',
    });

    return updatedAttempt;
  }
}
