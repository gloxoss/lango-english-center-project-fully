import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { db } from '@/libs/DB';
import { cashierSessions, user } from '@/models/Schema';
import { and, eq } from 'drizzle-orm';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { closeCashierSession } from '@/libs/services/cashier-close';

const closeSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().max(1000).optional(),
}).strict();

// POST /api/finance/cashier-sessions/:id/close — close an open cashier session
// with a declared physical count. Expected cash = float + total collected;
// variance = actual - expected. The closing is snapshotted into
// cashier_closings, the session is flipped to closed, and any variance is
// posted to GL (fail-open).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;

    const [sess] = await db
      .select({ branchId: user.branchId })
      .from(cashierSessions)
      .innerJoin(user, eq(cashierSessions.cashierId, user.id))
      .where(and(eq(cashierSessions.id, id), eq(cashierSessions.tenantId, tenantId)))
      .limit(1);
    if (sess) {
      // Shift data follows the cashier's campus (employee mode).
      assertBranchScope(context, sess.branchId);
    }
    const body = await parseJson(request, closeSchema);

    const { closing, variance } = await closeCashierSession({
      tenantId,
      sessionId: id,
      actualCash: body.actualCash,
      notes: body.notes,
      actorId: context.userId,
    });

    recordAudit(context, 'create', 'cashier_closing', closing.id, { variance });

    return NextResponse.json({
      success: true,
      data: closing,
      message: `Session clôturée — écart de ${variance >= 0 ? '+' : ''}${variance.toFixed(2)} MAD.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
