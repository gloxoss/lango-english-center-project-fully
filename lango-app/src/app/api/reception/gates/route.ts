import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { listGates } from '@/features/guard/services/gates-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.visitor.manage');
    // Only active gates for the front desk's check-in/out picker. Branch scope
    // follows the server-owned context branch.
    const gates = await listGates(context.tenantId!, context.branchId);
    const data = gates
      .filter((g) => g.isActive)
      .map((g) => ({ id: g.id, gateCode: g.gateCode, gateName: g.gateName, direction: g.direction, branchId: g.branchId }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
