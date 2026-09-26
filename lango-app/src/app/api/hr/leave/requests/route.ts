import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { createLeaveRequest, listLeaveRequests } from '@/features/hr/services/leave-requests';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { hasCapability } from '@/libs/api/permissions';

const submitRequestSchema = z.object({
  categoryId: z.string().uuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().max(500).optional(),
});

// GET /api/hr/leave/requests
// Employee sees own requests; hr.manage sees all pending requests for the tenant.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);

    const isHrAdmin = await hasCapability(ctx.userId, tenantId, ctx.role, 'payroll.leave.manage');
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // pending | approved | rejected | all

    const rows = await listLeaveRequests({
      tenantId,
      userId: isHrAdmin ? undefined : ctx.userId,
      statusFilter: statusFilter ?? undefined,
      ctx,
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// POST /api/hr/leave/requests
// Employee submits a leave request. Server validates balance.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    const body = await parseJson(request, submitRequestSchema);

    const leaveReq = await createLeaveRequest({
      tenantId,
      userId: ctx.userId,
      categoryId: body.categoryId,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    });

    recordAudit(ctx, 'create', 'leave_request', leaveReq?.id ?? 'leave_request', {});
    return NextResponse.json({ success: true, data: leaveReq }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
