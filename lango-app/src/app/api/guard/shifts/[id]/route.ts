import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardShiftUpdateSchema } from '@/features/guard/models/guard-validation';
import { archiveShift, updateShift } from '@/features/guard/services/gates-service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const { id } = await params;
    const body = await parseJson(request, guardShiftUpdateSchema);
    const shift = await updateShift(tenantId, id, body);
    recordAudit(context, 'update', 'guard_shift', shift.id, { name: shift.name });

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const { id } = await params;
    await archiveShift(tenantId, id);
    recordAudit(context, 'delete', 'guard_shift', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
