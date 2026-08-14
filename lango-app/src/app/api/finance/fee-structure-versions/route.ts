import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { feeStructures, feeStructureVersions } from '@/models/Schema';

// GET /api/finance/fee-structure-versions — published versions across all fee
// structures, for the allocation preview's structure/version selector. Draft
// versions are excluded: only published snapshots can be billed.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select({
        id: feeStructureVersions.id,
        feeStructureId: feeStructureVersions.feeStructureId,
        feeStructureName: feeStructures.name,
        versionNumber: feeStructureVersions.versionNumber,
        effectiveFrom: feeStructureVersions.effectiveFrom,
        status: feeStructureVersions.status,
        componentsSnapshot: feeStructureVersions.componentsSnapshot,
      })
      .from(feeStructureVersions)
      .innerJoin(feeStructures, eq(feeStructureVersions.feeStructureId, feeStructures.id))
      .where(eq(feeStructureVersions.tenantId, tenantId))
      .orderBy(desc(feeStructureVersions.createdAt));

    const data = rows
      .filter(r => r.status === 'published')
      .map(r => ({
        id: r.id,
        feeStructureId: r.feeStructureId,
        feeStructureName: r.feeStructureName,
        versionNumber: r.versionNumber,
        effectiveFrom: r.effectiveFrom,
        componentCount: Array.isArray(r.componentsSnapshot) ? (r.componentsSnapshot as unknown[]).length : 0,
      }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
