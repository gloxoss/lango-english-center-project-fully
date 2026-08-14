import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { branches, feeAllocationRuns, feeAllocationTargets, user } from '@/models/Schema';

// GET /api/finance/fee-allocations/:id — run header + per-student targets with
// their processing status, so a partial run can be inspected and resumed.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');
    const { id } = await params;

    const [run] = await db
      .select({
        id: feeAllocationRuns.id,
        period: feeAllocationRuns.period,
        feeStructureVersionId: feeAllocationRuns.feeStructureVersionId,
        feeScheduleId: feeAllocationRuns.feeScheduleId,
        branchId: feeAllocationRuns.branchId,
        branchName: branches.name,
        status: feeAllocationRuns.status,
        previewSummary: feeAllocationRuns.previewSummary,
        runById: feeAllocationRuns.runById,
        approvedById: feeAllocationRuns.approvedById,
        approvedAt: feeAllocationRuns.approvedAt,
        cancelledById: feeAllocationRuns.cancelledById,
        cancelledAt: feeAllocationRuns.cancelledAt,
        dueDate: feeAllocationRuns.dueDate,
        createdAt: feeAllocationRuns.createdAt,
        completedAt: feeAllocationRuns.completedAt,
      })
      .from(feeAllocationRuns)
      .leftJoin(branches, eq(feeAllocationRuns.branchId, branches.id))
      .where(and(eq(feeAllocationRuns.id, id), eq(feeAllocationRuns.tenantId, tenantId)))
      .limit(1);
    if (!run) {
      throw new ApiError(404, 'ALLOCATION_RUN_NOT_FOUND', 'Lancement d\'allocation introuvable.');
    }

    const targets = await db
      .select({
        id: feeAllocationTargets.id,
        studentId: feeAllocationTargets.studentId,
        studentName: user.name,
        amount: feeAllocationTargets.amount,
        status: feeAllocationTargets.status,
        reason: feeAllocationTargets.reason,
        error: feeAllocationTargets.error,
        invoiceId: feeAllocationTargets.invoiceId,
        processedAt: feeAllocationTargets.processedAt,
      })
      .from(feeAllocationTargets)
      .leftJoin(user, eq(feeAllocationTargets.studentId, user.id))
      .where(and(eq(feeAllocationTargets.tenantId, tenantId), eq(feeAllocationTargets.runId, id)));

    return NextResponse.json({ success: true, data: { run, targets } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
