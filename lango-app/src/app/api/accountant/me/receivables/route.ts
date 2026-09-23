import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoices, user } from '@/models/Schema';
import { casablancaTodayIso } from '@/libs/finance/today';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.read');

    const tenantId = requireTenant(ctx);
    const today = casablancaTodayIso();

    // Query pending/overdue invoices with student info
    const records = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        studentName: user.name,
        studentEmail: sql<string | null>`case when ${user.email} ilike '%@placeholder.local' then null else ${user.email} end`,
        amount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
        balance: sql<number>`(${invoices.netAmount} - ${invoices.paidAmount})::float`,
        status: invoices.status,
        dueDate: invoices.dueDate,
        issueDate: invoices.issueDate,
        daysOverdue: sql<number>`greatest(0, ${today}::date - ${invoices.dueDate}::date)::int`,
        isOverdue: sql<boolean>`${invoices.dueDate} < ${today}`,
      })
      .from(invoices)
      .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} in ('pending', 'overdue', 'partial')`,
          sql`${invoices.netAmount} > ${invoices.paidAmount}`,
          ctx.branchId ? eq(user.branchId, ctx.branchId) : undefined,
        ),
      )
      .orderBy(desc(invoices.dueDate));

    // Calculate aging summary buckets
    let notDue = 0;
    let current030 = 0;
    let overdue3160 = 0;
    let overdue6190 = 0;
    let overdue90Plus = 0;
    let totalOutstanding = 0;

    for (const item of records) {
      const bal = Number(item.balance || 0);
      const days = Number(item.daysOverdue || 0);
      totalOutstanding += bal;

      if (!item.isOverdue) {
        notDue += bal;
      } else if (days <= 30) {
        current030 += bal;
      } else if (days <= 60) {
        overdue3160 += bal;
      } else if (days <= 90) {
        overdue6190 += bal;
      } else {
        overdue90Plus += bal;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalOutstanding,
          notDue,
          current030,
          overdue3160,
          overdue6190,
          overdue90Plus,
          totalCount: records.length,
        },
        invoices: records,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
