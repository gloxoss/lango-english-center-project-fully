import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeLeaveBalances, leaveRequests } from '@/models/Schema';

const reviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
});

// PATCH /api/hr/leave/requests/[id]
// Approve or reject a leave request.
// On approval: atomically increments used_days in employee_leave_balances.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const { id } = await params;
    const body = await parseJson(request, reviewSchema);
    const { action } = body;

    const result = await db.transaction(async (tx) => {
      // Load the request
      const [req] = await tx
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.id, id), eq(leaveRequests.tenantId, tenantId)))
        .limit(1);

      if (!req) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande de congé introuvable.');
      }
      if (req.status !== 'pending') {
        throw new ApiError(409, 'ALREADY_REVIEWED', `Cette demande est déjà ${req.status}.`);
      }

      // Update request status
      const [updated] = await tx
        .update(leaveRequests)
        .set({
          status: action,
          reviewedById: ctx.userId,
          reviewedAt: new Date().toISOString(),
        })
        .where(eq(leaveRequests.id, id))
        .returning();

      // On approval: atomically update leave balance
      if (action === 'approved') {
        const currentYear = new Date(req.startDate).getFullYear();
        const days = Number(req.daysRequested);

        // Find existing balance record
        const [existingBalance] = await tx
          .select()
          .from(employeeLeaveBalances)
          .where(
            and(
              eq(employeeLeaveBalances.tenantId, tenantId),
              eq(employeeLeaveBalances.userId, req.userId),
              eq(employeeLeaveBalances.categoryId, req.categoryId),
              eq(employeeLeaveBalances.year, currentYear),
            ),
          )
          .limit(1);

        if (existingBalance) {
          const newUsed = Number(existingBalance.usedDays) + days;
          await tx
            .update(employeeLeaveBalances)
            .set({ usedDays: String(newUsed) })
            .where(eq(employeeLeaveBalances.id, existingBalance.id));
        }
        // If no balance record yet: leave it (no deduction — HR configured balance separately)
      }

      return updated;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
