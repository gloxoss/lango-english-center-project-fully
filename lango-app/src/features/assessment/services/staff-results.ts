import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import { classSubjects, subjects, user } from '@/models/Schema';

export type StaffOutcomeRow = {
  studentId: string;
  classSubjectId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  coefficient: number;
  score20: number | null;
  status: string;
  moderationState: string;
  date?: string | null;
};

export type StaffResultsOptions = {
  termStart?: string;
  termEnd?: string;
  examTermId?: string;
  studentIds?: string[];
};

/**
 * Staff-facing outcomes helper (GD2).
 * Returns outcomes for students of a class section in states 'graded', 'exempted', 'absent'
 * across all moderation states (draft, submitted, moderated, locked, published).
 * Uses a single query joining assessmentOutcomes -> assessmentDefinitions -> classSubjects -> subjects.
 */
export async function getSectionOutcomes(
  tenantId: string,
  classSectionId: string,
  opts?: StaffResultsOptions,
): Promise<StaffOutcomeRow[]> {
  // 1. Get student IDs in this class section
  const studentRows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      eq(user.classSectionId, classSectionId),
    ));

  let candidateIds = studentRows.map(s => s.id);
  if (opts?.studentIds && opts.studentIds.length > 0) {
    const filterSet = new Set(opts.studentIds);
    candidateIds = candidateIds.filter(id => filterSet.has(id));
  }

  if (candidateIds.length === 0) {
    return [];
  }

  const conditions = [
    eq(assessmentOutcomes.tenantId, tenantId),
    inArray(assessmentOutcomes.studentId, candidateIds),
    inArray(assessmentOutcomes.status, ['graded', 'exempted', 'absent']),
  ];

  const startDay = opts?.termStart ? opts.termStart.slice(0, 10) : null;
  const endDay = opts?.termEnd ? opts.termEnd.slice(0, 10) : null;

  if (opts?.examTermId && (startDay || endDay)) {
    const dateConditions = [];
    if (startDay) {
      dateConditions.push(gte(sql`substring(${assessmentOutcomes.createdAt}::text, 1, 10)`, startDay));
    }
    if (endDay) {
      dateConditions.push(lte(sql`substring(${assessmentOutcomes.createdAt}::text, 1, 10)`, endDay));
    }
    conditions.push(or(
      eq(assessmentDefinitions.termId, opts.examTermId),
      and(...dateConditions),
    )!);
  } else {
    if (opts?.examTermId) {
      conditions.push(eq(assessmentDefinitions.termId, opts.examTermId));
    }
    if (startDay) {
      conditions.push(gte(sql`substring(${assessmentOutcomes.createdAt}::text, 1, 10)`, startDay));
    }
    if (endDay) {
      conditions.push(lte(sql`substring(${assessmentOutcomes.createdAt}::text, 1, 10)`, endDay));
    }
  }

  const rows = await db
    .select({
      studentId: assessmentOutcomes.studentId,
      classSubjectId: assessmentDefinitions.classSubjectId,
      subjectId: classSubjects.subjectId,
      subjectName: subjects.name,
      title: assessmentDefinitions.title,
      coefficient: classSubjects.coefficient,
      normalizedScore: assessmentOutcomes.normalizedScore,
      status: assessmentOutcomes.status,
      moderationState: assessmentOutcomes.moderationState,
      date: assessmentOutcomes.createdAt,
    })
    .from(assessmentOutcomes)
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id),
    )
    .innerJoin(
      classSubjects,
      eq(assessmentDefinitions.classSubjectId, classSubjects.id),
    )
    .innerJoin(
      subjects,
      eq(classSubjects.subjectId, subjects.id),
    )
    .where(and(...conditions));

  return rows.map(r => ({
    studentId: r.studentId,
    classSubjectId: r.classSubjectId ?? '',
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    title: r.title,
    coefficient: Number(r.coefficient) || 1,
    score20: r.normalizedScore !== null ? Number(r.normalizedScore) : null,
    status: r.status,
    moderationState: r.moderationState,
    date: r.date,
  }));
}

/**
 * Per-student outcomes helper for single-student staff contexts.
 */
export async function getStudentOutcomes(
  tenantId: string,
  studentId: string,
  opts?: StaffResultsOptions,
): Promise<StaffOutcomeRow[]> {
  const [student] = await db
    .select({ classSectionId: user.classSectionId })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);

  if (!student?.classSectionId) {
    return [];
  }

  return getSectionOutcomes(tenantId, student.classSectionId, {
    ...opts,
    studentIds: [studentId],
  });
}
