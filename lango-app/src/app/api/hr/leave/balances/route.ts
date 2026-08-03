import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { employeeLeaveBalances, leaveCategories } from '@/models/Schema';

// GET /api/hr/leave/balances
// Returns the requesting employee's leave balances for the current year.
// HR admins pass ?userId=<id> to see another employee's balances.

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const url = new URL(request.url);
    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);
    const targetUserId = isHrAdmin ? (url.searchParams.get('userId') ?? ctx.userId) : ctx.userId;
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());

    const balances = await db
      .select({
        id: employeeLeaveBalances.id,
        categoryId: employeeLeaveBalances.categoryId,
        categoryName: leaveCategories.name,
        isPaid: leaveCategories.isPaid,
        daysPerYear: leaveCategories.daysPerYear,
        year: employeeLeaveBalances.year,
        accruedDays: employeeLeaveBalances.accruedDays,
        usedDays: employeeLeaveBalances.usedDays,
      })
      .from(employeeLeaveBalances)
      .innerJoin(leaveCategories, eq(employeeLeaveBalances.categoryId, leaveCategories.id))
      .where(
        and(
          eq(employeeLeaveBalances.tenantId, tenantId),
          eq(employeeLeaveBalances.userId, targetUserId),
          eq(employeeLeaveBalances.year, year),
        ),
      );

    const enriched = balances.map(b => ({
      ...b,
      remainingDays: Number(b.accruedDays) - Number(b.usedDays),
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
