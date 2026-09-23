import type { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import {
  collectedPaymentCondition,
  overdueInvoiceCondition,
} from '@/libs/finance/definitions';
import { casablancaTodayIso } from '@/libs/finance/today';
import { db } from '@/libs/DB';
import { cashierSessions, expenses, invoices, payments, user } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;
    const today = casablancaTodayIso();

    // Branch scope (visual runtime audit item 1): a branch-scoped accountant
    // sees their campus only, via the same money-follows-the-student rule as
    // the dashboard.
    const branchFilter = ctx.branchId ? eq(user.branchId, ctx.branchId) : undefined;

    // 1. Payments collected today (cash vs non-cash) — posted only, refunds
    // netted per payment (same correlated-subquery shape as netCollectedSumSql)
    // so a partially refunded payment contributes what the school kept.
    const netOfRefunds = sql`(${payments.amount} - coalesce((select sum(r.amount) from refunds r where r.payment_id = "payments"."id" and r.tenant_id = "payments"."tenant_id" and r.status = 'approved'), 0))`;
    const [paymentsToday] = await db
      .select({
        totalCash: sql<string>`coalesce(sum(case when ${payments.paymentMethod} = 'cash' then ${netOfRefunds} else 0 end), 0)::numeric::text`,
        totalOnline: sql<string>`coalesce(sum(case when ${payments.paymentMethod} != 'cash' then ${netOfRefunds} else 0 end), 0)::numeric::text`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(user, eq(payments.studentId, user.id))
      .where(
        and(
          eq(payments.tenantId, tenantId),
          collectedPaymentCondition(payments.status),
          sql`date(${payments.paymentDate}) = ${today}::date`,
          branchFilter,
        ),
      );

    // 2. Overdue invoices count & sum — the authoritative definition: still
    // owed (pending/partial/overdue) AND past due date. Drafts/credited/
    // cancelled are never chased.
    const [overdueSummary] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<string>`coalesce(sum(${invoices.netAmount} - ${invoices.paidAmount}), 0)::numeric::text`,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          overdueInvoiceCondition(invoices.status, invoices.dueDate, today),
          branchFilter,
        ),
      );

    // 3. Total expenses recorded
    const [expenseSummary] = await db
      .select({
        count: sql<number>`count(*)::int`,
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
