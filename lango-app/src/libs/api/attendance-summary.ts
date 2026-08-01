import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendance, attendanceSummary } from '@/models/Schema';

export async function recalculateStudentAttendanceSummary(tenantId: string, studentId: string, executor: any = db) {
  const records = await executor
    .select({
      status: attendance.status,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, studentId),
        eq(attendance.isVoided, false),
      ),
    );

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;

  for (const r of records) {
    if (r.status === 'present') {
      totalPresent++;
    } else if (r.status === 'absent') {
      totalAbsent++;
    } else if (r.status === 'late') {
      totalLate++;
    } else if (r.status === 'excused') {
      totalExcused++;
    }
  }

  const totalSessions = totalPresent + totalAbsent + totalLate + totalExcused;
  const attendanceRateVal = totalSessions > 0
    ? Number((((totalPresent + totalLate + totalExcused) / totalSessions) * 100).toFixed(2))
    : 100;

  // Delete existing summary cache row
  await executor
    .delete(attendanceSummary)
    .where(
      and(
        eq(attendanceSummary.tenantId, tenantId),
        eq(attendanceSummary.studentId, studentId),
      ),
    );

  // Insert updated summary cache
  const [updated] = await executor
    .insert(attendanceSummary)
    .values({
      tenantId,
      studentId,
      totalPresent,
      totalAbsent,
      totalLate,
      totalExcused,
      totalSessions,
      attendanceRate: attendanceRateVal.toFixed(2),
      lastUpdated: new Date().toISOString(),
    })
    .returning();

  return updated;
}
