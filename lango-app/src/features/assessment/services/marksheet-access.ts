import type { MarksheetPayload } from './marksheet-roster';
import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { getTeacherClassSectionIds, getTeacherClassSubjectPairs } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { classes, classSubjects } from '@/models/Schema';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { resolveMarksheetRoster } from './marksheet-roster';

/**
 * The marksheet roster, narrowed to what the caller is allowed to see.
 *
 * Teachers are scoped at SUBJECT level when the assessment carries a
 * classSubjectId: a teacher assigned to Mathematics in section A must not be
 * able to read or write the French assessment of the same section. The
 * previous implementation narrowed only by section, so any subject teacher of
 * a section could grade every subject in it.
 *
 * When an assessment has no classSubjectId (legacy rows, ad-hoc assessments),
 * the section-level scope is kept as a documented fallback. school_admin and
 * super_admin are never narrowed (the intentional override).
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

  // Campus lock: the marksheet's campus is the class behind its classSubject.
  // Applied to every role (teachers included) BEFORE the subject narrowing.
  {
    const [campus] = await db
      .select({ branchId: classes.branchId })
      .from(assessmentDefinitions)
      .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
      .leftJoin(classes, eq(classSubjects.classId, classes.id))
      .where(and(
        eq(assessmentDefinitions.id, assessmentDefinitionId),
        eq(assessmentDefinitions.tenantId, tenantId),
      ))
      .limit(1);
    assertBranchScope(context, campus?.branchId ?? null);
  }

  if (context.role !== 'teacher') {
    return payload;
  }

  const [definition] = await db
    .select({ classSubjectId: assessmentDefinitions.classSubjectId })
    .from(assessmentDefinitions)
    .where(and(
      eq(assessmentDefinitions.id, assessmentDefinitionId),
      eq(assessmentDefinitions.tenantId, tenantId),
    ))
    .limit(1);

  if (definition?.classSubjectId) {
    const pairs = await getTeacherClassSubjectPairs(tenantId, context.userId);
    const allowedSections = new Set<string>();
    for (const pair of pairs) {
      const [classSectionId, classSubjectId] = pair.split('|');
      if (classSubjectId === definition.classSubjectId && classSectionId) {
        allowedSections.add(classSectionId);
      }
    }
    payload.students = payload.students.filter(s => s.classSectionId && allowedSections.has(s.classSectionId));
  } else {
    const ownSections = new Set(await getTeacherClassSectionIds(tenantId, context.userId));
    payload.students = payload.students.filter(s => s.classSectionId && ownSections.has(s.classSectionId));
  }

  const visible = new Set(payload.students.map(s => s.studentId));
  payload.existingMarks = payload.existingMarks.filter(m => visible.has(m.studentId));

  return payload;
}

/**
 * The student ids a caller may write marks for.
 *
 * Returned as null for a non-teacher, meaning "no narrowing". A teacher gets
 * the explicit set, and a write naming anyone outside it must be refused
 * whole: marks are published to families, so a partially accepted batch is
 * worse than a rejected one.
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
