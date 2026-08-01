import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendanceRegisters } from '@/models/Schema';

const reopenSchema = z.object({
  registerId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, reopenSchema);

    const [existing] = await db
      .select()
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.id, body.registerId), eq(attendanceRegisters.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Registre introuvable');
    }
    if (existing.status === 'REOPENED') {
      throw new ApiError(409, 'ALREADY_REOPENED', 'Ce registre est déjà rouvert');
    }

    const [updated] = await db
      .update(attendanceRegisters)
      .set({
        status: 'REOPENED',
        reopenedAt: new Date().toISOString(),
        reopenedById: context.userId,
        reopenReason: body.reason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(attendanceRegisters.id, body.registerId))
      .returning();

    recordAudit(context, 'update', 'attendance_register', body.registerId, { action: 'reopen', reason: body.reason });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Registre ${existing.reference} rouvert pour correction.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
