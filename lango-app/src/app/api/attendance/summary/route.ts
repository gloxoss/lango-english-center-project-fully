import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendanceSummary, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get('studentId');

    const conditions = [eq(attendanceSummary.tenantId, tenantId)];

    if (context.role === 'student') {
      conditions.push(eq(attendanceSummary.studentId, context.userId));
    } else if (studentIdParam) {
      conditions.push(eq(attendanceSummary.studentId, studentIdParam));
    }

    const rows = await db
      .select({
        id: attendanceSummary.id,
        studentId: attendanceSummary.studentId,
        studentName: user.name,
        totalPresent: attendanceSummary.totalPresent,
        totalAbsent: attendanceSummary.totalAbsent,
        totalLate: attendanceSummary.totalLate,
        totalExcused: attendanceSummary.totalExcused,
        totalSessions: attendanceSummary.totalSessions,
        attendanceRate: attendanceSummary.attendanceRate,
        lastUpdated: attendanceSummary.lastUpdated,
      })
      .from(attendanceSummary)
      .innerJoin(user, eq(attendanceSummary.studentId, user.id))
      .where(and(...conditions));

    if (studentIdParam && rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: rows[0],
      });
    }

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
