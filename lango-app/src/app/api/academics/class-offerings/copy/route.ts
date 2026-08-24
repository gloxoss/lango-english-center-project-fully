import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  auditLogs,
  classes,
  classSubjects,
  classTeachers,
  sections,
  sessionYears,
  subjects,
  subjectTeachers,
  user,
} from '@/models/Schema';

export const copySessionSetupSchema = z.object({
  sourceSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session source est requis.' }),
  targetSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session cible est requis.' }),
  mode: z.enum(['preview', 'commit']),
  idempotencyKey: z.string().optional(),
  offeringIds: z.array(z.string().uuid()).optional(),
}).strict().refine((data) => data.sourceSessionYearId !== data.targetSessionYearId, {
  message: 'La session source et la session cible doivent être différentes.',
  path: ['targetSessionYearId'],
}).refine((data) => data.mode !== 'commit' || (data.idempotencyKey && data.idempotencyKey.length > 0), {
  message: 'Une clé d\'idempotence est requise pour confirmer la copie.',
  path: ['idempotencyKey'],
});

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, copySessionSetupSchema);

    // Validate sessions belong to tenant
    const [sourceSession] = await db
      .select({ id: sessionYears.id, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.sourceSessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!sourceSession) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session source est introuvable pour cet établissement.');
    }

    const [targetSession] = await db
      .select({ id: sessionYears.id, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.targetSessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!targetSession) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session cible est introuvable pour cet établissement.');
    }

    // Idempotency check for commit mode
    if (body.mode === 'commit' && body.idempotencyKey) {
      const copyEntityId = `${body.sourceSessionYearId}:${body.targetSessionYearId}:${body.idempotencyKey}`;
      const [existingAudit] = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.action, 'create'),
          eq(auditLogs.entityType, 'academic_class_offering_copy'),
          eq(auditLogs.entityId, copyEntityId),
        ))
        .limit(1);

      if (existingAudit) {
        return NextResponse.json({
          success: true,
          mode: 'commit',
          idempotent: true,
          message: 'La configuration a déjà été copiée vers cette session avec la même clé d\'idempotence.',
        });
      }
    }

    // Fetch active offerings from source session
    let sourceOfferings = await db
      .select()
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, body.sourceSessionYearId),
        eq(academicClassOfferings.status, 'active'),
      ));

    if (sourceOfferings.length === 0) {
      throw new ApiError(400, 'BAD_REQUEST', 'La session source ne contient aucune offre de classe active.');
    }

    // Apply the editable-preview selection when provided (subset of source offerings to copy)
    if (body.offeringIds && body.offeringIds.length > 0) {
      const selected = new Set(body.offeringIds);
      sourceOfferings = sourceOfferings.filter((o) => selected.has(o.id));
      if (sourceOfferings.length === 0) {
        throw new ApiError(400, 'BAD_REQUEST', 'Aucune offre de classe sélectionnée pour la copie.');
      }
    }

    // Fetch existing offerings in target session
    const targetOfferings = await db
      .select()
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, body.targetSessionYearId),
      ));

    const existingTargetKeyMap = new Set(
      targetOfferings.map((o) => `${o.classId}:${o.sectionId}`)
    );

    const offeringsToCreate = sourceOfferings.filter(
      (o) => !existingTargetKeyMap.has(`${o.classId}:${o.sectionId}`)
    );
    const offeringsSkippedCount = sourceOfferings.length - offeringsToCreate.length;

    const sourceOfferingIds = sourceOfferings.map((o) => o.id);

    // Fetch linked classSubjects for source offerings
    const linkedSubjects = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(classSubjects)
          .where(and(
            eq(classSubjects.tenantId, tenantId),
            inArray(classSubjects.offeringId, sourceOfferingIds),
          ))
      : [];

    // Fetch linked classTeachers for source offerings
    const linkedClassTeachers = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(classTeachers)
          .where(and(
            eq(classTeachers.tenantId, tenantId),
            inArray(classTeachers.offeringId, sourceOfferingIds),
          ))
      : [];

    // Fetch linked subjectTeachers for source offerings
    const linkedSubjectTeachers = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(subjectTeachers)
          .where(and(
            eq(subjectTeachers.tenantId, tenantId),
            inArray(subjectTeachers.offeringId, sourceOfferingIds),
          ))
      : [];

    if (body.mode === 'preview') {
      // Resolve human-readable names for the editable item-level preview
      const classIds = [...new Set(sourceOfferings.map((o) => o.classId))];
      const sectionIds = [...new Set(sourceOfferings.map((o) => o.sectionId))];
      const subjectIds = [...new Set([
        ...linkedSubjects.map((s) => s.subjectId),
        ...linkedSubjectTeachers.map((s) => s.subjectId),
      ])];
      const teacherIds = [...new Set([
        ...linkedClassTeachers.map((c) => c.teacherId),
        ...linkedSubjectTeachers.map((s) => s.teacherId),
      ])];

      const [classRows, sectionRows, subjectRows, teacherRows] = await Promise.all([
        classIds.length > 0
          ? db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.tenantId, tenantId), inArray(classes.id, classIds)))
          : Promise.resolve([] as { id: string; name: string }[]),
        sectionIds.length > 0
          ? db.select({ id: sections.id, name: sections.name }).from(sections).where(and(eq(sections.tenantId, tenantId), inArray(sections.id, sectionIds)))
          : Promise.resolve([] as { id: string; name: string }[]),
        subjectIds.length > 0
          ? db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.tenantId, tenantId), inArray(subjects.id, subjectIds)))
          : Promise.resolve([] as { id: string; name: string }[]),
        teacherIds.length > 0
          ? db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, teacherIds))
          : Promise.resolve([] as { id: string; name: string }[]),
      ]);

      const classNameMap = new Map(classRows.map((c) => [c.id, c.name]));
      const sectionNameMap = new Map(sectionRows.map((s) => [s.id, s.name]));
      const subjectNameMap = new Map(subjectRows.map((s) => [s.id, s.name]));
      const teacherNameMap = new Map(teacherRows.map((t) => [t.id, t.name]));

      const items = sourceOfferings.map((o) => ({
        sourceOfferingId: o.id,
        classId: o.classId,
        sectionId: o.sectionId,
        className: classNameMap.get(o.classId) ?? o.classId,
        sectionName: sectionNameMap.get(o.sectionId) ?? o.sectionId,
        capacity: o.capacity,
        willCreate: offeringsToCreate.some((x) => x.id === o.id),
        classSubjects: linkedSubjects.filter((s) => s.offeringId === o.id).map((s) => ({
          subjectId: s.subjectId,
          subjectName: subjectNameMap.get(s.subjectId) ?? s.subjectId,
          type: s.type,
        })),
        classTeachers: linkedClassTeachers.filter((c) => c.offeringId === o.id).map((c) => ({
          teacherId: c.teacherId,
          teacherName: teacherNameMap.get(c.teacherId) ?? c.teacherId,
          role: c.role,
        })),
        subjectTeachers: linkedSubjectTeachers.filter((s) => s.offeringId === o.id).map((s) => ({
          teacherId: s.teacherId,
          teacherName: teacherNameMap.get(s.teacherId) ?? s.teacherId,
          subjectId: s.subjectId,
          subjectName: subjectNameMap.get(s.subjectId) ?? s.subjectId,
        })),
      }));

      return NextResponse.json({
        success: true,
        mode: 'preview',
        summary: {
          sourceSessionName: sourceSession.name,
          targetSessionName: targetSession.name,
          sourceOfferingsCount: sourceOfferings.length,
          offeringsToCreateCount: offeringsToCreate.length,
          offeringsSkippedCount,
          classSubjectsToCreateCount: linkedSubjects.length,
          classTeachersToCreateCount: linkedClassTeachers.length,
          subjectTeachersToCreateCount: linkedSubjectTeachers.length,
        },
        items,
      });
    }

    // COMMIT MODE: Execute transactional copy
    const resultSummary = await db.transaction(async (tx) => {
      const createdOfferingMap = new Map<string, string>(); // sourceOfferingId -> targetOfferingId

      // Map existing target offerings first
      for (const targetOff of targetOfferings) {
        const sourceMatching = sourceOfferings.find(
          (so) => so.classId === targetOff.classId && so.sectionId === targetOff.sectionId
        );
        if (sourceMatching) {
          createdOfferingMap.set(sourceMatching.id, targetOff.id);
        }
      }

      // Insert new target offerings safely with conflict fallback
      for (const offToCreate of offeringsToCreate) {
        const [inserted] = await tx
          .insert(academicClassOfferings)
          .values({
            tenantId,
            sessionYearId: body.targetSessionYearId,
            classId: offToCreate.classId,
            sectionId: offToCreate.sectionId,
            capacity: offToCreate.capacity,
            status: 'active',
            displayOrder: offToCreate.displayOrder,
          })
          .onConflictDoNothing()
          .returning({ id: academicClassOfferings.id });

        if (inserted) {
          createdOfferingMap.set(offToCreate.id, inserted.id);
        } else {
          // If offering already exists in target session, find its ID
          const [existing] = await tx
            .select({ id: academicClassOfferings.id })
            .from(academicClassOfferings)
            .where(and(
              eq(academicClassOfferings.tenantId, tenantId),
              eq(academicClassOfferings.sessionYearId, body.targetSessionYearId),
              eq(academicClassOfferings.classId, offToCreate.classId),
              eq(academicClassOfferings.sectionId, offToCreate.sectionId),
            ))
            .limit(1);
          if (existing) {
            createdOfferingMap.set(offToCreate.id, existing.id);
          }
        }
      }

      let createdSubjectsCount = 0;
      let createdClassTeachersCount = 0;
      let createdSubjectTeachersCount = 0;

      // Copy classSubjects safely
      for (const subj of linkedSubjects) {
        if (!subj.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(subj.offeringId);
        if (!targetOfferingId) continue;

        // Check if classSubject already exists for this offering/subject
        // Check if classSubject already exists for this target offering/subject
        const [existingSubj] = await tx
          .select({ id: classSubjects.id })
          .from(classSubjects)
          .where(and(
            eq(classSubjects.tenantId, tenantId),
            eq(classSubjects.offeringId, targetOfferingId),
            eq(classSubjects.subjectId, subj.subjectId),
          ))
          .limit(1);

        if (!existingSubj) {
          const [inserted] = await tx
            .insert(classSubjects)
            .values({
              tenantId,
              classId: subj.classId,
              subjectId: subj.subjectId,
              type: subj.type,
              semesterId: subj.semesterId,
              offeringId: targetOfferingId,
            })
            .onConflictDoNothing()
            .returning({ id: classSubjects.id });

          if (inserted) {
            createdSubjectsCount++;
          }
        }
      }

      // Copy classTeachers safely
      for (const ct of linkedClassTeachers) {
        if (!ct.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(ct.offeringId);
        if (!targetOfferingId) continue;

        // Check if active classTeacher assignment already exists
        const [existingCt] = await tx
          .select({ id: classTeachers.id })
          .from(classTeachers)
          .where(and(
            eq(classTeachers.tenantId, tenantId),
            eq(classTeachers.offeringId, targetOfferingId),
            eq(classTeachers.teacherId, ct.teacherId),
          ))
          .limit(1);

        if (!existingCt) {
          const [inserted] = await tx
            .insert(classTeachers)
            .values({
              tenantId,
              classSectionId: ct.classSectionId,
              teacherId: ct.teacherId,
              offeringId: targetOfferingId,
              role: ct.role,
            })
            .onConflictDoNothing()
            .returning({ id: classTeachers.id });

          if (inserted) {
            createdClassTeachersCount++;
          }
        }
      }

      // Copy subjectTeachers safely
      for (const st of linkedSubjectTeachers) {
        if (!st.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(st.offeringId);
        if (!targetOfferingId) continue;

        // Ensure linked classSubject exists in target
        const targetClassSubj = await tx
          .select({ id: classSubjects.id })
          .from(classSubjects)
          .where(and(
            eq(classSubjects.tenantId, tenantId),
            eq(classSubjects.offeringId, targetOfferingId),
            eq(classSubjects.subjectId, st.subjectId),
          ))
          .limit(1);

        if (targetClassSubj.length > 0) {
          const [existingSt] = await tx
            .select({ id: subjectTeachers.id })
            .from(subjectTeachers)
            .where(and(
              eq(subjectTeachers.tenantId, tenantId),
              eq(subjectTeachers.offeringId, targetOfferingId),
              eq(subjectTeachers.subjectId, st.subjectId),
              eq(subjectTeachers.teacherId, st.teacherId),
            ))
            .limit(1);

          if (!existingSt) {
            const [inserted] = await tx
              .insert(subjectTeachers)
              .values({
                tenantId,
                classSectionId: st.classSectionId,
                subjectId: st.subjectId,
                classSubjectId: targetClassSubj[0]!.id,
                teacherId: st.teacherId,
                offeringId: targetOfferingId,
              })
              .onConflictDoNothing()
              .returning({ id: subjectTeachers.id });

            if (inserted) {
              createdSubjectTeachersCount++;
            }
          }
        }
      }

      recordAudit(
        context,
        'create',
        'academic_class_offering_copy',
        `${body.sourceSessionYearId}:${body.targetSessionYearId}:${body.idempotencyKey}`,
        {
          sourceSessionYearId: body.sourceSessionYearId,
          targetSessionYearId: body.targetSessionYearId,
          idempotencyKey: body.idempotencyKey,
        }
      );

      return {
        sourceSessionName: sourceSession.name,
        targetSessionName: targetSession.name,
        offeringsCreated: offeringsToCreate.length,
        offeringsSkipped: offeringsSkippedCount,
        classSubjectsCreated: createdSubjectsCount,
        classTeachersCreated: createdClassTeachersCount,
        subjectTeachersCreated: createdSubjectTeachersCount,
      };
    });

    return NextResponse.json({
      success: true,
      mode: 'commit',
      data: resultSummary,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
