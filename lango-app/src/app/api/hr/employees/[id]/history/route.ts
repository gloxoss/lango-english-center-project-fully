import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { getEmployee, listEmploymentEvents } from '@/features/hr/services/employees-service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const employee = await getEmployee(tenantId, id, false);
    if (!employee) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
    assertBranchScope(ctx, employee.branchId);

    const data = await listEmploymentEvents(tenantId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
