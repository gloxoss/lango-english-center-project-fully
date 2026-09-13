import type { MarksheetPayload } from './marksheet-roster';
import type { RequestContext } from '@/libs/api/context';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { resolveMarksheetRoster } from './marksheet-roster';

/**
 * The marksheet roster, narrowed to what the caller is allowed to see.
 *
 * Shared by the exam-term marksheet and the standalone grade-entry screen so the
 * teacher filter cannot be implemented once and forgotten the second time. The
 * roster carries every student's name and national id, so an unscoped read would
 * hand any teacher holding grading.manage the whole school's roll.
 */
export async function loadScopedMarksheet(
  context: RequestContext,
  tenantId: string,
  assessmentDefinitionId: string,
): Promise<MarksheetPayload | null> {
  const payload = await resolveMarksheetRoster(tenantId, assessmentDefinitionId);
  if (!payload) {
    return null;
  }

  if (context.role !== 'teacher') {
    return payload;
  }

  const ownSections = new Set(await getTeacherClassSectionIds(tenantId, context.userId));
  payload.students = payload.students.filter(s => s.classSectionId && ownSections.has(s.classSectionId));

  const visible = new Set(payload.students.map(s => s.studentId));
  payload.existingMarks = payload.existingMarks.filter(m => visible.has(m.studentId));

  return payload;
}

/**
 * The student ids a caller may write marks for.
 *
 * Returned as null for a non-teacher, meaning "no narrowing". A teacher gets the
 * explicit set, and a write naming anyone outside it must be refused whole: marks
 * are published to families, so a partially accepted batch is worse than a
 * rejected one.
 */
export async function writableStudentIds(
  context: RequestContext,
  tenantId: string,
  assessmentDefinitionId: string,
): Promise<Set<string> | null> {
  if (context.role !== 'teacher') {
    return null;
  }

  const payload = await loadScopedMarksheet(context, tenantId, assessmentDefinitionId);
  return new Set((payload?.students ?? []).map(s => s.studentId));
}
