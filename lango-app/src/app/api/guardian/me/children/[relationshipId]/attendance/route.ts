import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance, attendanceSummary } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

// GET /api/guardian/me/children/[relationshipId]/attendance — the child's
// attendance: authoritative summary counts (from attendanceSummary, the same
// source staff recalculate on approval) plus today's rows and recent notices.
// The child is server-resolved from the relationship (404 if not this
// guardian's effective child) and the `attendance` right is required (403).
type RouteParams = { params: Promise<{ relationshipId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { attendance: true });

    const tenantId = ctx.tenantId as string;

    const [summary] = await db
      .select({
        totalPresent: attendanceSummary.totalPresent,
        totalAbsent: attendanceSummary.totalAbsent,
        totalLate: attendanceSummary.totalLate,
        totalExcused: attendanceSummary.totalExcused,
        totalSessions: attendanceSummary.totalSessions,
        attendanceRate: attendanceSummary.attendanceRate,
      })
      .from(attendanceSummary)
      .where(and(
        eq(attendanceSummary.tenantId, tenantId),
        eq(attendanceSummary.studentId, auth.studentId),
      ))
      .orderBy(desc(attendanceSummary.lastUpdated))
      .limit(1);

    const recent = await db
      .select({
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
        subjectId: attendance.subjectId,
      })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, auth.studentId),
        eq(attendance.isVoided, false),
      ))
      .orderBy(desc(attendance.date))
      .limit(15);

    const todayIso = new Date().toISOString().slice(0, 10);
    const today = recent.filter((r) => r.date === todayIso);

    return NextResponse.json({
      success: true,
      data: {
        summary: summary
          ? {
              present: summary.totalPresent,
              absent: summary.totalAbsent,
              late: summary.totalLate,
              excused: summary.totalExcused,
              sessions: summary.totalSessions,
              rate: summary.attendanceRate,
            }
          : null,
        today: today.map((r) => ({
          status: r.status,
          lateMinutes: r.lateMinutes,
          subjectId: r.subjectId,
        })),
        recent: recent.map((r) => ({
          date: r.date,
          status: r.status,
          lateMinutes: r.lateMinutes,
          subjectId: r.subjectId,
        })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
