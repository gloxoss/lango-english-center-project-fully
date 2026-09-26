import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { reactivateEmployee } from '@/features/hr/services/offboarding-service';
import { getEmployee } from '@/features/hr/services/employees-service';

const reactivateSchema = z.object({ reason: z.string().trim().max(500).nullable().optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.access.manage');

    const body = await parseJson(request, reactivateSchema);
    // Campus lock on the dossier before reactivating it.
    const target = await getEmployee(tenantId, id, false);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
    assertBranchScope(ctx, target.branchId);
    await reactivateEmployee(tenantId, ctx.userId, id, body.reason);

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, id, sensitive);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');

    recordAudit(ctx, 'update', 'employee_reactivate', id, {});
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
