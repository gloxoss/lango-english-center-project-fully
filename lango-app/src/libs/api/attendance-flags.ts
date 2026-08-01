import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses, attendanceFlags } from '@/models/Schema';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
type FlagType = 'UNJUSTIFIED_ABSENCE' | 'CONSECUTIVE_ABSENCE' | 'REPEATED_LATE';

const SEVERITY_BY_TYPE: Record<FlagType, 'CRITIQUE' | 'ELEVE' | 'MOYEN'> = {
  CONSECUTIVE_ABSENCE: 'CRITIQUE',
  UNJUSTIFIED_ABSENCE: 'ELEVE',
  REPEATED_LATE: 'MOYEN',
};

function isWeekend(dateStr: string) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// Walks backward from `date` (inclusive) collecting the last `count` non-weekend
// dates. ponytail: no holiday calendar exists anywhere in this app yet, so only
// weekends are skipped - see ATTENDANCE-IMPLEMENTATION-PLAN.md Section 2.
function lastSchoolDays(date: string, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(`${date}T00:00:00Z`);
  while (days.length < count) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!isWeekend(iso)) {
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

    const lastThreeDays = lastSchoolDays(date, 3);
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
