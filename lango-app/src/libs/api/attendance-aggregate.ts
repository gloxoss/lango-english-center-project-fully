import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses } from '@/models/Schema';

/**
 * CANONICAL ATTENDANCE AGGREGATION (Phase 7A).
 *
 * Canonical metric contract (accepted SchoolOS semantics):
 *   PRESENT            status = 'present'
 *   ABSENT             status = 'absent'
 *   LATE               status = 'late'      — attended, late
 *   EXCUSED            status = 'excused'   — justified absence (Phase 3 rewrite)
 *   RECORDED TOTAL     all eligible marks (the four statuses)
 *   PRESENCE RATE      (present + late) / recordedTotal, NULL when 0.
 *                      Physical presence only — an excused absence is reported
 *                      as a justified absence, never as attendance.
 *   UNJUSTIFIED ABSENT absent marks WITHOUT an approved excuse matching their
 *                      exact scope (period/section when the excuse carries one)
 *
 * Eligible mark set (non-negotiable): tenant + academic session + isVoided=false
 * + date range + optional student/section scope. Voided and prior-session rows
 * never contribute; they remain stored for audit.
 */
export type AttendanceAggregate = {
  recordedTotal: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unjustifiedAbsentCount: number;
  presenceRate: number | null;
};

export type AttendanceAggregateScope = {
  tenantId: string;
  sessionYearId: string;
  studentId?: string;
  classSectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Optional transaction executor so callers inside a tx see their own writes. */
  executor?: any;
};

export async function getAttendanceAggregate(scope: AttendanceAggregateScope): Promise<AttendanceAggregate> {
  const queryExecutor = scope.executor ?? db;
  const conditions = [
    eq(attendance.tenantId, scope.tenantId),
    eq(attendance.academicYearId, scope.sessionYearId),
    eq(attendance.isVoided, false),
  ];
  if (scope.studentId) {
    conditions.push(eq(attendance.studentId, scope.studentId));
  }
  if (scope.classSectionId) {
    conditions.push(eq(attendance.classSectionId, scope.classSectionId));
  }
  if (scope.dateFrom) {
    conditions.push(gte(attendance.date, scope.dateFrom));
  }
  if (scope.dateTo) {
    conditions.push(lte(attendance.date, scope.dateTo));
  }

  const rows = await queryExecutor
    .select({ status: attendance.status, n: count() })
    .from(attendance)
    .where(and(...conditions))
    .groupBy(attendance.status) as Array<{ status: string; n: number }>;

  const byStatus = new Map(rows.map((row: { status: string; n: number }) => [row.status, Number(row.n)]));
  const presentCount = byStatus.get('present') ?? 0;
  const absentCount = byStatus.get('absent') ?? 0;
  const lateCount = byStatus.get('late') ?? 0;
  const excusedCount = byStatus.get('excused') ?? 0;
  const recordedTotal = presentCount + absentCount + lateCount + excusedCount;

  // UNJUSTIFIED TRUTH: an absent mark is justified only by an APPROVED excuse
  // covering its exact scope. Approval normally rewrites the mark to 'excused';
  // this EXISTS guard also covers legacy/tampered rows where the mark stayed
  // 'absent' while an approved excuse exists.
  let unjustifiedAbsentCount = absentCount;
  if (absentCount > 0) {
    const justifiedRows = await queryExecutor
      .select({ n: count() })
      .from(attendance)
      .where(and(
        ...conditions,
        eq(attendance.status, 'absent'),
        sql`EXISTS (
          SELECT 1 FROM ${attendanceExcuses} e
          WHERE e.tenant_id = ${attendance.tenantId}
            AND e.student_id = ${attendance.studentId}
            AND e.date = ${attendance.date}
            AND e.status = 'approved'
            AND (e.class_section_id IS NULL OR e.class_section_id = ${attendance.classSectionId})
            AND (e.period IS NULL OR e.period = ${attendance.period})
        )`,
      ));
    const justified = justifiedRows as Array<{ n: number }>;
    unjustifiedAbsentCount = absentCount - Number(justified[0]?.n ?? 0);
  }

  // Physical presence only. An excused absence is still an absence: the student
  // was not in the room. Counting it as present inflated every rate a justified
  // absence touched, and made "present" and "justified" impossible to tell apart
  // in the one number a director reads.
  const presenceRate = recordedTotal > 0
    ? Number((((presentCount + lateCount) / recordedTotal) * 100).toFixed(2))
    : null;

  return {
    recordedTotal,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    unjustifiedAbsentCount,
    presenceRate,
  };
}
