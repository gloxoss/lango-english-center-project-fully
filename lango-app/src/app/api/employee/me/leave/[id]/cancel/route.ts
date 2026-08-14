import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { leaveRequests } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

// POST /api/employee/me/leave/[id]/cancel
// Cancel a leave request while it is still pending. Once approved/rejected it
// is locked; the employee cannot retract it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const { id } = await params;

    const [req] = await db
      .select()
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.id, id),
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.userId, ctx.userId),
      ))
      .limit(1);

    if (!req) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande de congé introuvable.');
    }
    if (req.status !== 'pending') {
      throw new ApiError(409, 'ALREADY_REVIEWED', `Impossible d'annuler une demande ${req.status}.`);
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({ status: 'cancelled' })
      .where(and(eq(leaveRequests.id, req.id), eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.userId, ctx.userId), eq(leaveRequests.status, 'pending')))
      .returning();

    if (!updated) throw new ApiError(409, 'LEAVE_STATE_CHANGED', 'La demande a été traitée pendant l’annulation.');

    recordAudit(ctx, 'update', 'leave_request', req.id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
