import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardAssignmentUpdateSchema } from '@/features/guard/models/guard-validation';
import { cancelAssignment, updateAssignment } from '@/features/guard/services/gates-service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const { id } = await params;
    const body = await parseJson(request, guardAssignmentUpdateSchema);
    const assignment = await updateAssignment(tenantId, context.branchId, id, body);
    recordAudit(context, 'update', 'guard_assignment', assignment.id, { status: assignment.status });

    return NextResponse.json({ success: true, data: assignment });
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
    await cancelAssignment(tenantId, id);
    recordAudit(context, 'delete', 'guard_assignment', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
