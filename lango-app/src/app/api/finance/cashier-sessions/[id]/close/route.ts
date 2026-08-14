import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { cashierClosings, cashierSessions } from '@/models/Schema';

const closeSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().max(1000).optional(),
}).strict();

// POST /api/finance/cashier-sessions/:id/close — close an open cashier session
// with a declared physical count. Expected cash = float + total collected;
// variance = actual - expected. The closing is snapshotted into
// cashier_closings and the session is flipped to closed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;
    const body = await parseJson(request, closeSchema);

    const [session] = await db
      .select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.id, id), eq(cashierSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', 'Session de caisse introuvable.');
    }
    if (session.status !== 'open') {
      throw new ApiError(409, 'ALREADY_CLOSED', 'Cette session de caisse est déjà clôturée.');
    }

    const expectedCash = Number(session.startingFloat) + Number(session.totalCollected);
    const actualCash = body.actualCash;
    const variance = actualCash - expectedCash;

    const [closing] = await db
      .insert(cashierClosings)
      .values({
        tenantId,
        cashierSessionId: id,
        cashierId: session.cashierId,
        expectedCash,
        actualCash,
        variance,
        notes: body.notes ?? null,
        closedById: context.userId,
      })
      .returning();

    await db
      .update(cashierSessions)
      .set({ status: 'closed', closedAt: new Date().toISOString(), expectedCash, actualCash })
      .where(eq(cashierSessions.id, id));

    recordAudit(context, 'create', 'cashier_closing', closing!.id, { variance });

    return NextResponse.json({
      success: true,
      data: closing!,
      message: `Session clôturée — écart de ${variance >= 0 ? '+' : ''}${variance.toFixed(2)} MAD.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
