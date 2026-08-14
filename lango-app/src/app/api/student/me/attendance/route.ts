import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance } from '@/models/Schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/attendance — the session student's own attendance
// history (most recent first). Scoped strictly by studentId + tenantId; voided
// rows are excluded. No arbitrary studentId is ever accepted.

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const rows = await db
      .select({
        date: attendance.date,
        status: attendance.status,
        period: attendance.period,
        note: attendance.note,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, studentId),
          eq(attendance.isVoided, false),
        ),
      )
      .orderBy(attendance.date);

    const summary = { present: 0, absent: 0, late: 0, excused: 0, total: rows.length };
    for (const r of rows) {
      const s = r.status as keyof typeof summary;
      if (s in summary) summary[s] += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        records: rows,
        summary,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
