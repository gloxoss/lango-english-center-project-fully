import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { examSeats, examTerms, examHalls } from '@/features/assessment/models/assessment-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const { searchParams } = new URL(request.url);
    const examTermId = searchParams.get('examTermId');

    const conditions = [eq(examSeats.tenantId, tenantId)];
    if (examTermId) conditions.push(eq(examSeats.examTermId, examTermId as any));

    const rows = await db.select({
      id: examSeats.id,
      studentId: examSeats.studentId,
      studentName: user.name,
      studentMatricule: user.matricule,
      candidateNumber: examSeats.candidateNumber,
      seatNumber: examSeats.seatNumber,
      deskLabel: examSeats.deskLabel,
      examTermId: examSeats.examTermId,
      termName: examTerms.name,
      termDate: examTerms.startDate,
      hallName: examHalls.name,
    })
      .from(examSeats)
      .innerJoin(examTerms, eq(examSeats.examTermId, examTerms.id))
      .innerJoin(examHalls, eq(examSeats.examHallId, examHalls.id))
      .innerJoin(user, eq(examSeats.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(examTerms.startDate), examSeats.seatNumber);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
