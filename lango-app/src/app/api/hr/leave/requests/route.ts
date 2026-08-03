import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeLeaveBalances, leaveCategories, leaveRequests, user } from '@/models/Schema';

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

    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // pending | approved | rejected | all

    const rows = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        employeeName: user.name,
        categoryId: leaveRequests.categoryId,
        categoryName: leaveCategories.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        daysRequested: leaveRequests.daysRequested,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
        reviewedById: leaveRequests.reviewedById,
        reviewedAt: leaveRequests.reviewedAt,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .innerJoin(user, eq(leaveRequests.userId, user.id))
      .innerJoin(leaveCategories, eq(leaveRequests.categoryId, leaveCategories.id))
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          isHrAdmin ? undefined : eq(leaveRequests.userId, ctx.userId),
          statusFilter && statusFilter !== 'all'
            ? eq(leaveRequests.status, statusFilter)
            : undefined,
        ),
      );

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
    const body = await parseJson(request, submitRequestSchema);

    // Validate dates
    if (body.endDate < body.startDate) {
      throw new ApiError(400, 'INVALID_DATES', 'La date de fin doit être après la date de début.');
    }

    // Calculate business days requested (simple: calendar days including weekends for now)
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const diffMs = end.getTime() - start.getTime();
    const daysRequested = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Verify category belongs to tenant
    const [category] = await db
      .select({ id: leaveCategories.id, daysPerYear: leaveCategories.daysPerYear })
      .from(leaveCategories)
      .where(and(eq(leaveCategories.id, body.categoryId), eq(leaveCategories.tenantId, tenantId)))
      .limit(1);

    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Catégorie de congé introuvable.');
    }

    // Check leave balance for current year
    const currentYear = new Date().getFullYear();
    const [balance] = await db
      .select()
      .from(employeeLeaveBalances)
      .where(
        and(
          eq(employeeLeaveBalances.tenantId, tenantId),
          eq(employeeLeaveBalances.userId, ctx.userId),
          eq(employeeLeaveBalances.categoryId, body.categoryId),
          eq(employeeLeaveBalances.year, currentYear),
        ),
      )
      .limit(1);

    if (balance) {
      const remaining = Number(balance.accruedDays) - Number(balance.usedDays);
      if (daysRequested > remaining) {
        throw new ApiError(422, 'INSUFFICIENT_BALANCE', `Solde insuffisant. Restant: ${remaining} jour(s), demandé: ${daysRequested}.`);
      }
    }
    // If no balance record yet: allow request (HR will validate on approval)

    const [leaveReq] = await db
      .insert(leaveRequests)
      .values({
        tenantId,
        userId: ctx.userId,
        categoryId: body.categoryId,
        startDate: body.startDate,
        endDate: body.endDate,
        daysRequested: String(daysRequested),
        status: 'pending',
        reason: body.reason ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: leaveReq }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
