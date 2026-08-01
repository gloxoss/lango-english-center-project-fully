import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { meetingSlots } from '@/models/Schema';

const createSlotSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const items = await db
      .select()
      .from(meetingSlots)
      .where(eq(meetingSlots.tenantId, tenantId))
      .orderBy(desc(meetingSlots.startTime));

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createSlotSchema);

    const [slot] = await db
      .insert(meetingSlots)
      .values({
        tenantId,
        teacherId: context.userId,
        startTime: body.startTime,
        endTime: body.endTime,
        status: 'open',
      })
      .returning();

    if (slot) {
      await recordAudit(context, 'create', 'meeting_slot', slot.id);
    }

    return NextResponse.json({
      success: true,
      data: slot,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
