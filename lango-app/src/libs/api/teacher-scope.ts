import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classTeachers, sessionYears, subjectTeachers } from '@/models/Schema';

/**
 * Teacher operational scope — CURRENT assignments only.
 *
 * Class-teacher rows are current when `status='active'` and not ended.
 * Subject-teacher rows (migration 0146) are current when `status='active'`,
 * not ended, and — when year-scoped — attached to the tenant's default session.
 * Ended or year-old assignments must never authorize attendance, grades, live
 * classes or schedule eligibility.
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDefaultSessionYearId(tenantId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);
  return row?.id ?? null;
}

export async function getTeacherClassSectionIds(tenantId: string, teacherUserId: string): Promise<string[]> {
  const today = todayIso();
  const defaultSessionYearId = await getDefaultSessionYearId(tenantId);
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
      .where(and(
        eq(subjectTeachers.tenantId, tenantId),
        eq(subjectTeachers.teacherId, teacherUserId),
        eq(subjectTeachers.status, 'active'),
        or(isNull(subjectTeachers.endsOn), gte(subjectTeachers.endsOn, today))!,
        defaultSessionYearId
          ? or(isNull(subjectTeachers.sessionYearId), eq(subjectTeachers.sessionYearId, defaultSessionYearId))!
          : isNull(subjectTeachers.sessionYearId),
      )),
  ]);

  const set = new Set<string>();
  for (const r of ctRows) {
    if (r.classSectionId) set.add(r.classSectionId);
  }
  for (const r of stRows) {
    if (r.classSectionId) set.add(r.classSectionId);
  }
  return Array.from(set);
}

/**
 * Current (classSection, classSubject) pairs a teacher is authorized to teach.
 * This is the subject-level authorization key used by grade entry: being the
 * teacher of Mathematics in section A must not authorize marking French for
 * the same section, and a closed/year-old assignment must stop authorizing.
 */
export async function getTeacherClassSubjectPairs(tenantId: string, teacherUserId: string): Promise<Set<string>> {
  const today = todayIso();
  const defaultSessionYearId = await getDefaultSessionYearId(tenantId);
  const rows = await db
    .select({ classSectionId: subjectTeachers.classSectionId, classSubjectId: subjectTeachers.classSubjectId })
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.teacherId, teacherUserId),
      eq(subjectTeachers.status, 'active'),
      or(isNull(subjectTeachers.endsOn), gte(subjectTeachers.endsOn, today))!,
      defaultSessionYearId
        ? or(isNull(subjectTeachers.sessionYearId), eq(subjectTeachers.sessionYearId, defaultSessionYearId))!
        : isNull(subjectTeachers.sessionYearId),
    ));

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
  const today = todayIso();
  const [row] = await db
    .select({ id: subjectTeachers.id })
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.teacherId, teacherUserId),
      eq(subjectTeachers.classSectionId, classSectionId),
      eq(subjectTeachers.classSubjectId, classSubjectId),
      eq(subjectTeachers.status, 'active'),
      or(isNull(subjectTeachers.endsOn), gte(subjectTeachers.endsOn, today))!,
    ))
    .limit(1);
  return Boolean(row);
}
