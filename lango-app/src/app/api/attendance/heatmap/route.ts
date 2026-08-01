import { and, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get('studentId');
    const monthParam = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const studentId = context.role === 'student' ? context.userId : studentIdParam;
    if (!studentId) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'studentId requis' } }, { status: 400 });
    }

    const [year, month] = monthParam.split('-').map(Number) as [number, number];
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = `${monthParam}-01`;
    const monthEnd = `${monthParam}-${String(daysInMonth).padStart(2, '0')}`;

    const rows = await db
      .select({ date: attendance.date, status: attendance.status, lateMinutes: attendance.lateMinutes })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, studentId),
        gte(attendance.date, monthStart),
        lte(attendance.date, monthEnd),
        eq(attendance.isVoided, false),
      ));

    return NextResponse.json({ success: true, data: { month: monthParam, daysInMonth, records: rows } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
