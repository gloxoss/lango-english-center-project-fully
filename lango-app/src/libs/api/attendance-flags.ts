import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { resolveInstructionalDay } from '@/libs/api/school-day';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses, attendanceFlags, user } from '@/models/Schema';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
type FlagType = 'UNJUSTIFIED_ABSENCE' | 'CONSECUTIVE_ABSENCE' | 'REPEATED_LATE';

const SEVERITY_BY_TYPE: Record<FlagType, 'CRITIQUE' | 'ELEVE' | 'MOYEN'> = {
  CONSECUTIVE_ABSENCE: 'CRITIQUE',
  UNJUSTIFIED_ABSENCE: 'ELEVE',
  REPEATED_LATE: 'MOYEN',
};

/** The student's current section is the calendar context for their flags. */
async function studentSectionId(tenantId: string, studentId: string, executor: any): Promise<string | null> {
  const [row] = await executor
    .select({ classSectionId: user.classSectionId })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.id, studentId)))
    .limit(1);
  return row?.classSectionId ?? null;
}

/**
 * CANONICAL calendar predicate (Phase 5): delegates to the one school-day
 * resolver. When the student has no section context, only the legacy
 * weekend/session rule can apply (no timetable to consult).
 */
async function isInstructional(tenantId: string, sectionId: string | null, date: string): Promise<boolean> {
  const result = await resolveInstructionalDay({
    tenantId,
    sectionId: sectionId ?? '00000000-0000-0000-0000-000000000000',
    date,
  });
  return result.instructional;
}

/**
 * Walks backward from `date` (inclusive) collecting the last `count`
 * INSTRUCTIONAL dates — consecutive absence is about consecutive school days,
 * never raw calendar days (Phase 5 correction).
 */
async function lastInstructionalDays(tenantId: string, sectionId: string | null, date: string, count: number): Promise<string[]> {
  const days: string[] = [];
  const cursor = new Date(`${date}T00:00:00Z`);
  let guard = 0;
  while (days.length < count && guard < 31) {
    guard++;
    const iso = cursor.toISOString().slice(0, 10);
    if (await isInstructional(tenantId, sectionId, iso)) {
      days.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

async function hasOpenFlag(tenantId: string, studentId: string, type: FlagType, executor: any) {
  const [existing] = await executor
    .select({ id: attendanceFlags.id })
    .from(attendanceFlags)
    .where(and(
      eq(attendanceFlags.tenantId, tenantId),
      eq(attendanceFlags.studentId, studentId),
      eq(attendanceFlags.type, type),
      eq(attendanceFlags.status, 'OPEN'),
    ))
    .limit(1);
  return !!existing;
}

export async function detectAndRecordFlags(
  tenantId: string,
  studentId: string,
  date: string,
  status: AttendanceStatus,
  executor: any = db,
) {
  // CALENDAR GUARD (Phase 5): a confirmed non-instructional day never
  // generates absence/late flags or escalations.
  const sectionId = await studentSectionId(tenantId, studentId, executor);
  if (!(await isInstructional(tenantId, sectionId, date))) {
    return;
  }

  if (status === 'absent') {
    const [approvedExcuse] = await executor
      .select({ id: attendanceExcuses.id })
      .from(attendanceExcuses)
      .where(and(
        eq(attendanceExcuses.tenantId, tenantId),
        eq(attendanceExcuses.studentId, studentId),
        eq(attendanceExcuses.date, date),
        eq(attendanceExcuses.status, 'approved'),
      ))
      .limit(1);

    if (!approvedExcuse && !(await hasOpenFlag(tenantId, studentId, 'UNJUSTIFIED_ABSENCE', executor))) {
      await executor.insert(attendanceFlags).values({ tenantId, studentId, type: 'UNJUSTIFIED_ABSENCE', status: 'OPEN', severity: SEVERITY_BY_TYPE.UNJUSTIFIED_ABSENCE });
    }

    const lastThreeDays = await lastInstructionalDays(tenantId, sectionId, date, 3);
    const rows = await executor
      .select({ date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, studentId),
        inArray(attendance.date, lastThreeDays),
        eq(attendance.isVoided, false),
      ));
    const statusByDate = new Map(rows.map((r: { date: string; status: string }) => [r.date, r.status]));
    const allThreeAbsent = lastThreeDays.every(d => statusByDate.get(d) === 'absent');
    if (allThreeAbsent && !(await hasOpenFlag(tenantId, studentId, 'CONSECUTIVE_ABSENCE', executor))) {
      await executor.insert(attendanceFlags).values({ tenantId, studentId, type: 'CONSECUTIVE_ABSENCE', status: 'OPEN', severity: SEVERITY_BY_TYPE.CONSECUTIVE_ABSENCE });
    }
  }

  if (status === 'late') {
    const monthStart = `${date.slice(0, 7)}-01`;
    const [{ count }] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, studentId),
        eq(attendance.status, 'late'),
        gte(attendance.date, monthStart),
        lte(attendance.date, date),
        eq(attendance.isVoided, false),
      ));
    if (count >= 5 && !(await hasOpenFlag(tenantId, studentId, 'REPEATED_LATE', executor))) {
      await executor.insert(attendanceFlags).values({ tenantId, studentId, type: 'REPEATED_LATE', status: 'OPEN', severity: SEVERITY_BY_TYPE.REPEATED_LATE });
    }
  }
}

// Flags carry no date column (dropped - see Schema.ts), so we match on
// detectedAt's calendar date. Flags are created synchronously when that
// date's attendance is recorded, so detectedAt's date always equals the
// absence date.
export async function resolveUnjustifiedAbsenceFlagsForDate(tenantId: string, studentId: string, date: string, executor: any = db) {
  await executor
    .update(attendanceFlags)
    .set({ status: 'RESOLVED', resolvedAt: new Date().toISOString() })
    .where(and(
      eq(attendanceFlags.tenantId, tenantId),
      eq(attendanceFlags.studentId, studentId),
      eq(attendanceFlags.type, 'UNJUSTIFIED_ABSENCE'),
      eq(attendanceFlags.status, 'OPEN'),
      sql`${attendanceFlags.detectedAt}::date = ${date}::date`,
    ));
}
