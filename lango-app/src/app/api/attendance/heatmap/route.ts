import { and, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { getGuardianChildIds } from '@/libs/api/guardian-scope';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { attendance, user } from '@/models/Schema';

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

    // GUARDIAN SCOPE (P0): parents only ever read their own linked children.
    if (context.role === 'parent') {
      const childIds = await getGuardianChildIds(tenantId, context.userId);
      if (!childIds.includes(studentId)) {
        throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable.');
      }
    }

    // STUDENT SCOPE (P0): the student must exist in this tenant; branch-limited
    // callers only read their own campus; teachers only their sections.
    const [studentRow] = await db
      .select({ branchId: user.branchId, classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!studentRow) {
      throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable.');
    }
    if (context.branchId && studentRow.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cet élève appartient à un autre campus.');
    }
    if (context.role === 'teacher') {
      const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
      if (!studentRow.classSectionId || !assignedIds.includes(studentRow.classSectionId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Cet élève ne fait pas partie de vos classes.');
      }
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
