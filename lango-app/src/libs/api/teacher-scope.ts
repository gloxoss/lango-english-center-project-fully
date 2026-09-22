import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classTeachers, subjectTeachers } from '@/models/Schema';

/**
 * Teacher operational scope.
 *
 * IMPORTANT: only CURRENT assignments grant access. A class-teacher row that
 * has been ended (endsOn in the past, or status != 'active') must stop granting
 * attendance/grade/live-class rights immediately — the previous implementation
 * ignored endsOn/status and left ended assignments authoritative forever.
 *
 * subject_teachers has no status/endsOn columns in the current schema; a row
 * there is the assignment. Deleting it would destroy the only record of who
 * taught what, so it is intentionally left in place (deferred migration).
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTeacherClassSectionIds(tenantId: string, teacherUserId: string): Promise<string[]> {
  const today = todayIso();
  const [ctRows, stRows] = await Promise.all([
    db
      .select({ classSectionId: classTeachers.classSectionId })
      .from(classTeachers)
      .where(and(
        eq(classTeachers.tenantId, tenantId),
        eq(classTeachers.teacherId, teacherUserId),
        eq(classTeachers.status, 'active'),
        or(isNull(classTeachers.endsOn), gte(classTeachers.endsOn, today))!,
      )),
    db
      .select({ classSectionId: subjectTeachers.classSectionId })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherUserId))),
  ]);

  const set = new Set<string>();
  for (const r of ctRows) {
    if (r.classSectionId) {
      set.add(r.classSectionId);
    }
  }
  for (const r of stRows) {
    if (r.classSectionId) {
      set.add(r.classSectionId);
    }
  }
  return Array.from(set);
}

/**
 * Current (classSection, classSubject) pairs a teacher is authorized to teach.
 * This is the subject-level authorization key used by grade entry: being the
 * teacher of Mathematics in section A must not authorize marking French for
 * the same section.
 */
export async function getTeacherClassSubjectPairs(tenantId: string, teacherUserId: string): Promise<Set<string>> {
  const rows = await db
    .select({ classSectionId: subjectTeachers.classSectionId, classSubjectId: subjectTeachers.classSubjectId })
    .from(subjectTeachers)
    .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherUserId)));

  const pairs = new Set<string>();
  for (const row of rows) {
    pairs.add(`${row.classSectionId}|${row.classSubjectId}`);
  }
  return pairs;
}

export async function isTeacherAssignedToClassSubject(
  tenantId: string,
  teacherUserId: string,
  classSectionId: string,
  classSubjectId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: subjectTeachers.id })
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.teacherId, teacherUserId),
      eq(subjectTeachers.classSectionId, classSectionId),
      eq(subjectTeachers.classSubjectId, classSubjectId),
    ))
    .limit(1);
  return Boolean(row);
}
