import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendanceRegisters, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');
    const periodParam = searchParams.get('period');

    if (!classId || !date) {
      return NextResponse.json({ success: true, data: null });
    }

    const period = periodParam ? Number.parseInt(periodParam, 10) : 1;

    const [row] = await db
      .select({
        id: attendanceRegisters.id,
        reference: attendanceRegisters.reference,
        status: attendanceRegisters.status,
        submittedAt: attendanceRegisters.submittedAt,
        submittedById: attendanceRegisters.submittedById,
        submittedByName: user.name,
        reopenedAt: attendanceRegisters.reopenedAt,
        reopenReason: attendanceRegisters.reopenReason,
        correctionNote: attendanceRegisters.correctionNote,
      })
      .from(attendanceRegisters)
      .leftJoin(user, eq(attendanceRegisters.submittedById, user.id))
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, classId),
        eq(attendanceRegisters.date, date),
        eq(attendanceRegisters.period, period),
      ))
      .limit(1);

    return NextResponse.json({ success: true, data: row ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
