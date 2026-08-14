import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardGateCreateSchema } from '@/features/guard/models/guard-validation';
import { createGate, listGates } from '@/features/guard/services/gates-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const branchId = new URL(request.url).searchParams.get('branchId');
    const gates = await listGates(tenantId, branchId);
    return NextResponse.json({ success: true, data: gates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const body = await parseJson(request, guardGateCreateSchema);
    const gate = await createGate(tenantId, body);
    recordAudit(context, 'create', 'guard_gate', gate.id, { code: gate.gateCode });

    return NextResponse.json({ success: true, data: gate });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
