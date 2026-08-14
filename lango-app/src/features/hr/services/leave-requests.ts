import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { employeeLeaveBalances, leaveCategories, leaveRequests, user } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';

export type ListLeaveRequestsParams = {
  tenantId: string;
  /** Restrict to one user's requests. Undefined = all users (HR admin view). */
  userId?: string;
  statusFilter?: string;
};

export async function listLeaveRequests({ tenantId, userId, statusFilter }: ListLeaveRequestsParams) {
  return db
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
        userId ? eq(leaveRequests.userId, userId) : undefined,
        statusFilter && statusFilter !== 'all' ? eq(leaveRequests.status, statusFilter) : undefined,
      ),
    );
}

export type CreateLeaveRequestInput = {
  tenantId: string;
  userId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  if (input.endDate < input.startDate) {
    throw new ApiError(400, 'INVALID_DATES', 'La date de fin doit être après la date de début.');
  }

  // Business days requested (calendar days including weekends for now)
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const diffMs = end.getTime() - start.getTime();
  const daysRequested = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

  // Verify category belongs to tenant
  const [category] = await db
    .select({ id: leaveCategories.id, daysPerYear: leaveCategories.daysPerYear })
    .from(leaveCategories)
    .where(and(eq(leaveCategories.id, input.categoryId), eq(leaveCategories.tenantId, input.tenantId)))
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
        eq(employeeLeaveBalances.tenantId, input.tenantId),
        eq(employeeLeaveBalances.userId, input.userId),
        eq(employeeLeaveBalances.categoryId, input.categoryId),
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
      tenantId: input.tenantId,
      userId: input.userId,
      categoryId: input.categoryId,
      startDate: input.startDate,
      endDate: input.endDate,
      daysRequested: String(daysRequested),
      status: 'pending',
      reason: input.reason ?? null,
    })
    .returning();

  if (!leaveReq) {
    throw new ApiError(500, 'LEAVE_CREATE_FAILED', 'Impossible de créer la demande de congé.');
  }

  return leaveReq;
}
