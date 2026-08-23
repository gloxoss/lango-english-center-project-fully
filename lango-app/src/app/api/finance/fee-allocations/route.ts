import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { branches, feeAllocationRuns, feeAllocationTargets, feeStructures, feeStructureVersions, user } from '@/models/Schema';

// GET /api/finance/fee-allocations — tenant-scoped list of allocation runs with
// per-run target counts (pending/included/error). Fee allocations live here, on
// their own namespace, because /api/finance/allocations is payment allocations.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const runs = await db
      .select({
        id: feeAllocationRuns.id,
        period: feeAllocationRuns.period,
        feeStructureVersionId: feeAllocationRuns.feeStructureVersionId,
        feeStructureName: feeStructures.name,
        branchId: feeAllocationRuns.branchId,
        branchName: branches.name,
        status: feeAllocationRuns.status,
        previewSummary: feeAllocationRuns.previewSummary,
        runById: feeAllocationRuns.runById,
        runByName: user.name,
        dueDate: feeAllocationRuns.dueDate,
        createdAt: feeAllocationRuns.createdAt,
        completedAt: feeAllocationRuns.completedAt,
      })
      .from(feeAllocationRuns)
      .leftJoin(feeStructureVersions, eq(feeAllocationRuns.feeStructureVersionId, feeStructureVersions.id))
      .leftJoin(feeStructures, eq(feeStructureVersions.feeStructureId, feeStructures.id))
      .leftJoin(branches, eq(feeAllocationRuns.branchId, branches.id))
      .leftJoin(user, eq(feeAllocationRuns.runById, user.id))
      .where(eq(feeAllocationRuns.tenantId, tenantId))
      .orderBy(desc(feeAllocationRuns.createdAt));

    const counts = await db
      .select({
        runId: feeAllocationTargets.runId,
        status: feeAllocationTargets.status,
        count: sql<number>`count(*)`,
      })
      .from(feeAllocationTargets)
      .where(eq(feeAllocationTargets.tenantId, tenantId))
      .groupBy(feeAllocationTargets.runId, feeAllocationTargets.status);

    const byRun = new Map<string, { pending: number; included: number; error: number }>();
    for (const c of counts) {
      const cur = byRun.get(c.runId) ?? { pending: 0, included: 0, error: 0 };
      const n = Number(c.count);
      if (c.status === 'included') cur.included = n;
      else if (c.status === 'error') cur.error = n;
      else cur.pending = n;
      byRun.set(c.runId, cur);
    }

    const data = runs.map(r => ({
      ...r,
      counts: byRun.get(r.id) ?? { pending: 0, included: 0, error: 0 },
    }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
