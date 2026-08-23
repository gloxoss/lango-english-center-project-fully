import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { reconcileCashierSession } from '@/libs/services/cashier-close';

// POST /api/finance/cashier-sessions/:id/reconcile — mark a closed cashier
// session reconciled (post-close review step). Requires finance.approve.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.approve');
    const { id } = await params;

    const updated = await reconcileCashierSession({ tenantId, id, actorId: context.userId });

    recordAudit(context, 'update', 'cashier_reconcile', id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
