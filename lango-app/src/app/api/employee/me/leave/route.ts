import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { createLeaveRequest, listLeaveRequests } from '@/features/hr/services/leave-requests';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

const submitLeaveSchema = z.object({
  categoryId: z.string().uuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().max(500).optional(),
}).strict();

// GET /api/employee/me/leave — own leave requests only
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const rows = await listLeaveRequests({ tenantId, userId: ctx.userId });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/employee/me/leave — create own pending leave request.
// Shares the exact eligibility/balance logic the admin route uses.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const body = await parseJson(request, submitLeaveSchema);

    const leaveReq = await createLeaveRequest({
      tenantId,
      userId: ctx.userId,
      categoryId: body.categoryId,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    });

    recordAudit(ctx, 'create', 'leave_request', leaveReq.id);

    return NextResponse.json({ success: true, data: leaveReq }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
