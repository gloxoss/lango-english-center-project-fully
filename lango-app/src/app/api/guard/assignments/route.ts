import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardAssignmentCreateSchema } from '@/features/guard/models/guard-validation';
import { createAssignment, listAssignments } from '@/features/guard/services/gates-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const branchId = new URL(request.url).searchParams.get('branchId');
    const assignments = await listAssignments(tenantId, branchId);
    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.gates.manage');

    const body = await parseJson(request, guardAssignmentCreateSchema);
    const assignment = await createAssignment(tenantId, context.branchId, body);
    recordAudit(context, 'create', 'guard_assignment', assignment.id, {
      guardUserId: assignment.guardUserId,
      gateId: assignment.gateId,
      shiftId: assignment.shiftId,
    });

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
