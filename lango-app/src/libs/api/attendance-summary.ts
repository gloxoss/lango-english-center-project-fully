import { and, eq } from 'drizzle-orm';
import { getAttendanceAggregate } from '@/libs/api/attendance-aggregate';
import { db } from '@/libs/DB';
import { getDefaultSessionYearId } from '@/libs/services/subject-teacher-assignment';
import { attendanceSummary } from '@/models/Schema';

/**
 * SESSION-SCOPED, CANONICAL summary cache (Phase 7A).
 *
 * Derived data only: every count/rate comes from getAttendanceAggregate —
 * voided rows excluded, prior sessions excluded, correction counted once,
 * rate NULL (not 100) when nothing was recorded.
 */
export async function recalculateStudentAttendanceSummary(tenantId: string, studentId: string, executor: any = db) {
  const sessionYearId = await getDefaultSessionYearId(tenantId);

  const aggregate = sessionYearId
    ? await getAttendanceAggregate({ tenantId, sessionYearId, studentId, executor })
    : {
        recordedTotal: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        unjustifiedAbsentCount: 0,
        presenceRate: null,
      };

  await executor
    .delete(attendanceSummary)
    .where(
      and(
        eq(attendanceSummary.tenantId, tenantId),
        eq(attendanceSummary.studentId, studentId),
      ),
    );

  const [updated] = await executor
    .insert(attendanceSummary)
    .values({
      tenantId,
      studentId,
      academicYearId: sessionYearId,
      totalPresent: aggregate.presentCount,
      totalAbsent: aggregate.absentCount,
      totalLate: aggregate.lateCount,
      totalExcused: aggregate.excusedCount,
      totalSessions: aggregate.recordedTotal,
      attendanceRate: aggregate.presenceRate === null ? null : aggregate.presenceRate.toFixed(2),
      lastUpdated: new Date().toISOString(),
    })
    .returning();

  return updated;
}
