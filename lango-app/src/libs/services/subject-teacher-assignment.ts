import { and, count, eq, ne } from 'drizzle-orm';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classScheduleSlots, subjectTeachers } from '@/models/Schema';

/**
 * Guard for subject-teacher assignment removal.
 *
 * `subject_teachers` has no history columns today (no sessionYearId, no
 * status, no endsOn) — a row IS the assignment and there is no way to close it
 * while keeping the record. A delete therefore removes the only record of who
 * taught that subject to that section.
 *
 * Until the TEACHER SUBJECT ASSIGNMENT HISTORY MIGRATION lands (see
 * future-implementation/teacher-subject-assignment-history/README.md), this
 * guard refuses the destructive case:
 *
 *   - Deleting one of several teachers for the same (section, class-subject)
 *     pair is allowed — the teaching context is still represented by the
 *     remaining teacher row(s).
 *   - Deleting the LAST teacher for the pair is allowed only when the
 *     assignment was never used (no timetable slot, no assessment authored,
 *     no mark recorded). A clean removal created by mistake stays possible.
 *   - Deleting the last teacher with any teaching evidence is refused with
 *     409 SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED, and nothing is
 *     deleted.
 */
export async function assertSubjectAssignmentRemovable(tenantId: string, subjectTeacherId: string): Promise<void> {
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

  // Another teacher still covers the same (section, class-subject): the
  // teaching context survives the deletion, so it may proceed.
  const [others] = await db
    .select({ n: count() })
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.classSectionId, row.classSectionId),
      eq(subjectTeachers.classSubjectId, row.classSubjectId),
      ne(subjectTeachers.id, row.id),
    ));
  if (Number(others?.n ?? 0) > 0) {
    return;
  }

  // Last row for the pair — destructive only if the assignment was actually
  // used. Evidence: timetabled slots, authored assessments, recorded marks.
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

  const evidence = Number(slotRows[0]?.n ?? 0) + Number(definitionRows[0]?.n ?? 0) + Number(outcomeRows[0]?.n ?? 0);
  if (evidence > 0) {
    throw new ApiError(
      409,
      'SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED',
      'Cette affectation possède un historique académique qui doit être conservé. La modification directe n\'est pas disponible tant que l\'ancienne affectation n\'a pas été clôturée correctement.',
    );
  }
}
