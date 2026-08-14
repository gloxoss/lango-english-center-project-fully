import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { decideLeavePass, getLeavePass } from '@/features/hostel/services/leave-passes-service';

const decideSchema = z.object({
  decision: z.enum(['approved', 'denied']),
  approverRole: z.enum(['warden', 'guardian', 'school_admin']),
  reason: z.string().max(2000).nullish(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.read');

    const { id } = await params;
    const data = await getLeavePass(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');

    const body = await parseJson(request, decideSchema);
    // Guardian decisions are self-service: identity is verified inside the
    // service against the pass's student. Staff decisions need the capability.
    if (body.approverRole !== 'guardian') {
      await requireCapability(context, 'hostel.supervision.manage');
    }

    const { id } = await params;
    const pass = await decideLeavePass(tenantId, context.userId, id, {
      decision: body.decision,
      approverRole: body.approverRole,
      reason: body.reason ?? null,
    });
    recordAudit(context, 'update', 'hostel_leave_pass', id,
      { decision: body.decision, approverRole: body.approverRole });
    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
