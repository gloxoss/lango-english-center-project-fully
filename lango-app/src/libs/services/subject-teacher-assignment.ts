import { and, count, desc, eq, gte, isNull, or } from 'drizzle-orm';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { getCurrentSessionYearId } from '@/libs/services/school-year';
import { classScheduleSlots, subjectTeachers } from '@/models/Schema';

/**
 * TEACHER SUBJECT ASSIGNMENT HISTORY (migration 0146).
 *
 * `subject_teachers` now carries sessionYearId / startsOn / endsOn / status.
 * Reassignment is close-then-insert; a current assignment is
 * `status='active' AND (endsOn IS NULL OR endsOn >= today)` and, when the row is
 * year-scoped, belongs to the target session year.
 *
 * A hard delete stays allowed only for a mistake with no teaching evidence.
 * Rows with evidence are CLOSED (kept as history) instead — never destroyed.
 */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Delegates to the canonical resolver (libs/services/school-year). */
export async function getDefaultSessionYearId(tenantId: string): Promise<string | null> {
  return getCurrentSessionYearId(tenantId);
}

/** Current-assignment SQL predicate (null endsOn = open-ended). */
export function currentAssignmentCondition(column: typeof subjectTeachers.endsOn, statusColumn: typeof subjectTeachers.status) {
  return and(
    eq(statusColumn, 'active'),
    or(isNull(column), gte(column, todayIso()))!,
  )!;
}

/**
 * Does this assignment have teaching evidence (timetable slot, authored
 * assessment, recorded mark)? Evidence means it must survive as history.
 */
export async function subjectAssignmentUsage(tenantId: string, subjectTeacherId: string): Promise<number> {
  const [row] = await db
    .select({
      id: subjectTeachers.id,
      classSectionId: subjectTeachers.classSectionId,
      classSubjectId: subjectTeachers.classSubjectId,
      teacherId: subjectTeachers.teacherId,
    })
    .from(subjectTeachers)
    .where(and(eq(subjectTeachers.id, subjectTeacherId), eq(subjectTeachers.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  }

  const [slotRows, definitionRows, outcomeRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(classScheduleSlots)
      .where(and(
        eq(classScheduleSlots.tenantId, tenantId),
        eq(classScheduleSlots.teacherId, row.teacherId),
        eq(classScheduleSlots.classSectionId, row.classSectionId),
        eq(classScheduleSlots.classSubjectId, row.classSubjectId),
      )),
    db
      .select({ n: count() })
      .from(assessmentDefinitions)
      .where(and(
        eq(assessmentDefinitions.tenantId, tenantId),
        eq(assessmentDefinitions.classSubjectId, row.classSubjectId),
        eq(assessmentDefinitions.createdBy, row.teacherId),
      )),
    db
      .select({ n: count() })
      .from(assessmentOutcomes)
      .innerJoin(assessmentDefinitions, eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id))
      .where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentDefinitions.classSubjectId, row.classSubjectId),
        eq(assessmentOutcomes.markerId, row.teacherId),
      )),
  ]);

  return Number(slotRows[0]?.n ?? 0) + Number(definitionRows[0]?.n ?? 0) + Number(outcomeRows[0]?.n ?? 0);
}

/**
 * Close every currently-active assignment for a (section, class-subject) pair
 * — optionally scoped to one teacher — before inserting the replacement.
 */
export async function closeActiveSubjectAssignments(
  tenantId: string,
  classSectionId: string,
  classSubjectId: string,
  opts: { teacherId?: string; endsOn?: string } = {},
): Promise<number> {
  const conditions = [
    eq(subjectTeachers.tenantId, tenantId),
    eq(subjectTeachers.classSectionId, classSectionId),
    eq(subjectTeachers.classSubjectId, classSubjectId),
    eq(subjectTeachers.status, 'active'),
    isNull(subjectTeachers.endsOn),
  ];
  if (opts.teacherId) {
    conditions.push(eq(subjectTeachers.teacherId, opts.teacherId));
  }
  const closed = await db
    .update(subjectTeachers)
    .set({ status: 'inactive', endsOn: opts.endsOn ?? todayIso() })
    .where(and(...conditions))
    .returning({ id: subjectTeachers.id });
  return closed.length;
}

export type RemoveAssignmentResult = { action: 'deleted'; id: string; evidence: number };

/**
 * Remove an assignment safely:
 *   - no teaching evidence  -> hard delete (clean mistake)
 *   - teaching evidence     -> 409 SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED,
 *     nothing mutated. The row is the only record of the relationship; it must
 *     be migrated or superseded by a close-then-insert reassignment, never
 *     destroyed by a delete click.
 */
export async function removeSubjectAssignment(tenantId: string, subjectTeacherId: string): Promise<RemoveAssignmentResult> {
  const evidence = await subjectAssignmentUsage(tenantId, subjectTeacherId);
  if (evidence > 0) {
    throw new ApiError(
      409,
      'SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED',
      'Cette affectation porte un historique académique (emploi du temps, évaluations ou notes). Elle ne peut pas être supprimée : migrez l\'historique ou remplacez l\'affectation par une nouvelle affectation.',
    );
  }

  await db
    .delete(subjectTeachers)
    .where(and(eq(subjectTeachers.id, subjectTeacherId), eq(subjectTeachers.tenantId, tenantId)));
  return { action: 'deleted', id: subjectTeacherId, evidence };
}

/** Historical assignments for a pair, most recent first (reporting/UI). */
export async function listClosedSubjectAssignments(tenantId: string, classSectionId: string, classSubjectId: string) {
  return db
    .select()
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.classSectionId, classSectionId),
      eq(subjectTeachers.classSubjectId, classSubjectId),
      eq(subjectTeachers.status, 'inactive'),
    ))
    .orderBy(desc(subjectTeachers.endsOn))
    .limit(50);
}
