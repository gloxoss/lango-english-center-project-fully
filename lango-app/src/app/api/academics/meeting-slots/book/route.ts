import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardianStudents, guardians, meetingSlots } from '@/models/Schema';

const bookSlotSchema = z.object({
  slotId: z.string().uuid(),
  studentId: z.string().min(1),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, bookSlotSchema);

    // Get guardian profile for current user
    const [guardian] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.userId, context.userId), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardian) {
      throw new ApiError(403, 'FORBIDDEN', 'Profil parent/tuteur non trouvé.');
    }

    // Verify parent is linked to student
    const [link] = await db
      .select({ studentId: guardianStudents.studentId })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, guardian.id), eq(guardianStudents.studentId, body.studentId)))
      .limit(1);

    if (!link) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous n\'êtes pas autorisé à réserver un créneau pour cet élève.');
    }

    const [slot] = await db
      .select()
      .from(meetingSlots)
      .where(and(eq(meetingSlots.id, body.slotId), eq(meetingSlots.tenantId, tenantId)))
      .limit(1);

    if (!slot) {
      throw new ApiError(404, 'NOT_FOUND', 'Créneau de rendez-vous introuvable.');
    }

    if (slot.status !== 'open') {
      throw new ApiError(422, 'SLOT_NOT_AVAILABLE', 'Ce créneau n\'est plus disponible.');
    }

    const [booked] = await db
      .update(meetingSlots)
      .set({
        status: 'booked',
        bookedByGuardianId: guardian.id,
        studentId: body.studentId,
      })
      .where(and(eq(meetingSlots.id, body.slotId), eq(meetingSlots.tenantId, tenantId)))
      .returning();

    await recordAudit(context, 'update', 'meeting_slot_booking', body.slotId);

    return NextResponse.json({
      success: true,
      data: booked,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
