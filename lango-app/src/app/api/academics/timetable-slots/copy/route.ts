import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classScheduleSlots } from '@/models/Schema';

const copySlotsSchema = z.object({
  fromClassSectionId: z.string().uuid(),
  toClassSectionId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, copySlotsSchema);

    const sourceSlots = await db
      .select()
      .from(classScheduleSlots)
      .where(
        and(
          eq(classScheduleSlots.tenantId, tenantId),
          eq(classScheduleSlots.classSectionId, body.fromClassSectionId)
        )
      );

    if (sourceSlots.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucun créneau trouvé dans la classe source.');
    }

    const newSlots = sourceSlots.map((slot) => ({
      tenantId,
      classSectionId: body.toClassSectionId,
      classSubjectId: slot.classSubjectId,
      teacherId: slot.teacherId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomLabel: slot.roomLabel,
    }));

    const inserted = await db
      .insert(classScheduleSlots)
      .values(newSlots)
      .returning();

    await recordAudit(context, 'create', 'timetable_copy', body.toClassSectionId, {
      copiedCount: inserted.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        copiedCount: inserted.length,
        slots: inserted,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
