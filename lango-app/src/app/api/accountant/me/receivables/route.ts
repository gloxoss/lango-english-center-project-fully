import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoices, user } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;

    // Query pending/overdue invoices with student info
    const records = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        studentName: user.name,
        studentEmail: user.email,
        amount: invoices.amount,
        paidAmount: invoices.paidAmount,
        balance: sql<number>`${invoices.amount} - ${invoices.paidAmount}`,
        status: invoices.status,
        dueDate: invoices.dueDate,
        issueDate: invoices.issueDate,
        daysOverdue: sql<number>`greatest(0, CURRENT_DATE - ${invoices.dueDate}::date)`,
      })
      .from(invoices)
      .leftJoin(user, eq(invoices.studentId, user.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} in ('pending', 'overdue', 'partial')`,
        ),
      )
      .orderBy(desc(invoices.dueDate));

    // Calculate aging summary buckets
    let current030 = 0;
    let overdue3160 = 0;
    let overdue6190 = 0;
    let overdue90Plus = 0;
    let totalOutstanding = 0;

    for (const item of records) {
      const bal = Number(item.balance || 0);
      const days = Number(item.daysOverdue || 0);
      totalOutstanding += bal;

      if (days <= 30) {
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
