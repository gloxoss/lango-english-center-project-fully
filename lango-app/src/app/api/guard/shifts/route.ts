import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardShiftCreateSchema } from '@/features/guard/models/guard-validation';
import { createShift, listShifts } from '@/features/guard/services/gates-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const branchId = new URL(request.url).searchParams.get('branchId');
    const shifts = await listShifts(tenantId, branchId);
    return NextResponse.json({ success: true, data: shifts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const body = await parseJson(request, guardShiftCreateSchema);
    const shift = await createShift(tenantId, body);
    recordAudit(context, 'create', 'guard_shift', shift.id, { name: shift.name });

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
