import type { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { cashierSessions, expenses, invoices, payments } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;
    const today = new Date().toISOString().split('T')[0]!;

    // 1. Payments collected today (cash vs non-cash)
    const [paymentsToday] = await db
      .select({
        totalCash: sql<number>`coalesce(sum(case when ${payments.paymentMethod} = 'cash' then ${payments.amount} else 0 end), 0)`,
        totalOnline: sql<number>`coalesce(sum(case when ${payments.paymentMethod} != 'cash' then ${payments.amount} else 0 end), 0)`,
        totalCount: sql<number>`count(*)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          sql`date(${payments.paymentDate}) = ${today}::date`,
        ),
      );

    // 2. Overdue invoices count & sum
    const [overdueSummary] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`coalesce(sum(${invoices.amount} - ${invoices.paidAmount}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} in ('pending', 'overdue', 'partially_paid')`,
        ),
      );

    // 3. Total expenses recorded
    const [expenseSummary] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(eq(expenses.tenantId, tenantId));

    // 4. Current user active cashier session
    const [activeSession] = await db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.tenantId, tenantId),
          eq(cashierSessions.cashierId, userId),
          eq(cashierSessions.status, 'open'),
        ),
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        cashCollectedToday: Number(paymentsToday?.totalCash ?? 0),
        onlineCollectedToday: Number(paymentsToday?.totalOnline ?? 0),
        totalPaymentsTodayCount: Number(paymentsToday?.totalCount ?? 0),
        pendingOverdueInvoicesCount: Number(overdueSummary?.count ?? 0),
        pendingOverdueTotalAmount: Number(overdueSummary?.totalAmount ?? 0),
        pendingApprovalsCount: Number(expenseSummary?.count ?? 0),
        activeCashierSession: activeSession || null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
