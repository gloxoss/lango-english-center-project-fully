import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classes, classSections, expenses, invoices, payments, sections, user } from '@/models/Schema';

// ponytail: reuses the same parallel-aggregate pattern as /api/analytics -
// no fabricated numbers. Multi-campus is dropped entirely (tenants has no
// campus/branch sub-entity - one tenant is one school). "Encaissements par
// cycle" is dropped too - user.cycle is never set for students, only
// teachers (see /api/analytics's own note on the same gap).
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const sixMonthsAgo = monthsAgo(6);

    const [
      collectedByMonth,
      invoicedByMonth,
      expensesByMonth,
      unpaidInvoices,
      unpaidByClass,
    ] = await Promise.all([
      db.select({ month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${invoices.issueDate}::date, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${expenses.amount}), 0)::float` })
        .from(expenses)
        .where(and(eq(expenses.tenantId, tenantId), gte(expenses.expenseDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`),
      db.select({ netAmount: invoices.netAmount, paidAmount: invoices.paidAmount })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), ne(invoices.status, 'cancelled'))),
      db.select({
        className: classes.name,
        sectionName: sections.name,
        netAmount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
      })
        .from(invoices)
        .innerJoin(user, eq(invoices.studentId, user.id))
        .innerJoin(classSections, eq(user.classSectionId, classSections.id))
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(and(eq(invoices.tenantId, tenantId), ne(invoices.status, 'cancelled'))),
    ]);

    const firstOfThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(firstOfThisMonth);
      d.setMonth(d.getMonth() - (5 - i));
      return d.toISOString().slice(0, 7);
    });
    const toMap = (rows: { month: string; total: number }[]) => new Map(rows.map(r => [r.month, r.total]));
    const collectedMap = toMap(collectedByMonth);
    const invoicedMap = toMap(invoicedByMonth);
    const expensesMap = toMap(expensesByMonth);

    const monthlyTrend = months.map(m => ({
      month: m,
      collected: collectedMap.get(m) ?? 0,
      invoiced: invoicedMap.get(m) ?? 0,
      expenses: expensesMap.get(m) ?? 0,
    }));

    const thisMonth = monthlyTrend[monthlyTrend.length - 1]!;
    const lastMonth = monthlyTrend[monthlyTrend.length - 2] ?? { collected: 0, invoiced: 0, expenses: 0 };
    const pctChange = (curr: number, prev: number): number | null => (prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null);

    const totalInvoiced = unpaidInvoices.reduce((sum, i) => sum + i.netAmount, 0);
    const totalCollected = unpaidInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 1000) / 10 : 0;

    const byClass = new Map<string, number>();
    for (const row of unpaidByClass) {
      const label = `${row.className} ${row.sectionName}`.trim();
      const balance = Math.max(0, row.netAmount - row.paidAmount);
      if (balance > 0) {
        byClass.set(label, (byClass.get(label) ?? 0) + balance);
      }
    }
    const outstandingByClass = Array.from(byClass.entries())
      .map(([className, amount]) => ({ className, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      data: {
        totalCollected: thisMonth.collected,
        collectedChangePct: pctChange(thisMonth.collected, lastMonth.collected),
        totalOutstanding,
        totalExpenses: thisMonth.expenses,
        expensesChangePct: pctChange(thisMonth.expenses, lastMonth.expenses),
        netResult: thisMonth.collected - thisMonth.expenses,
        collectionRate,
        monthlyTrend,
        outstandingByClass,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
