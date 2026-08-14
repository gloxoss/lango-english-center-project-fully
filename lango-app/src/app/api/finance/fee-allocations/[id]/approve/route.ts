import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { feeAllocationRuns } from '@/models/Schema';

// PUT /api/finance/fee-allocations/:id/approve — formalize a preview before
// billing. Optional step: the author may run a preview directly. The approver
// must differ from the author (maker/checker separation).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;

    const [run] = await db
      .select()
      .from(feeAllocationRuns)
      .where(and(eq(feeAllocationRuns.id, id), eq(feeAllocationRuns.tenantId, tenantId)))
      .limit(1);
    if (!run) {
      throw new ApiError(404, 'ALLOCATION_RUN_NOT_FOUND', 'Lancement d\'allocation introuvable.');
    }
    if (run.status !== 'previewed') {
      throw new ApiError(409, 'ALLOCATION_NOT_APPROVABLE', `Lancement non approuvable (statut ${run.status}).`);
    }
    if (run.runById === context.userId) {
      throw new ApiError(403, 'SELF_APPROVAL', 'Vous ne pouvez pas approuver votre propre lancement.');
    }

    const [updated] = await db
      .update(feeAllocationRuns)
      .set({ status: 'approved', approvedById: context.userId, approvedAt: new Date().toISOString() })
      .where(and(eq(feeAllocationRuns.id, id), eq(feeAllocationRuns.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'fee_allocation_approve', id, { approvedById: context.userId });

    return NextResponse.json({ success: true, data: updated, message: 'Allocation approuvée. Vous pouvez maintenant lancer la facturation.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
