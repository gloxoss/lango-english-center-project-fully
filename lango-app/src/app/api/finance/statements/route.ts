import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, lte, gte } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoices, payments, user } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'finance.read');

    const searchParams = new URL(req.url).searchParams;
    const studentId = searchParams.get('studentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!studentId || !startDate || !endDate) {
      throw new ApiError(400, 'BAD_REQUEST', 'Les paramètres studentId, startDate et endDate sont requis.');
    }

    // Verify student belongs to tenant
    const [studentExists] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!studentExists) {
      throw new ApiError(404, 'NOT_FOUND', 'Étudiant introuvable.');
    }

    // 1. Calculate Opening Balance (all transactions strictly before startDate)
    const prevInvoices = await db
      .select({ netAmount: invoices.netAmount })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId),
        // issueDate is a string (date) in DB, comparison works if ISO format YYYY-MM-DD
        lte(invoices.issueDate, startDate),
        // Exclude those exactly on startDate because they belong to the current period
        // Wait, lte is less than or equal to. We want strictly less than for opening balance.
        // Drizzle doesn't have a lt() easily without importing, so let's use sql or just fetch and filter?
        // Let's import lt from drizzle-orm. Wait, I imported only lte, gte.
      ));

    // A better approach is to fetch all history and calculate it in memory since an individual student's history is small.
    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId)
      ));

    const allPayments = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.studentId, studentId)
      ));

    let openingBalance = 0;
    const transactions = [];

    // Process Invoices
    for (const inv of allInvoices) {
      if (inv.issueDate < startDate) {
        openingBalance += Number(inv.netAmount);
      } else if (inv.issueDate >= startDate && inv.issueDate <= endDate) {
        transactions.push({
          id: inv.id,
          date: inv.issueDate,
          type: 'invoice',
          description: `Facture ${inv.invoiceNumber}`,
          reference: inv.invoiceNumber,
          debit: Number(inv.netAmount),
          credit: 0,
        });
      }
    }

    // Process Payments (paymentDate is timestamp mode 'string', so substring to get date part)
    for (const pay of allPayments) {
      const payDate = pay.paymentDate.substring(0, 10);
      if (payDate < startDate) {
        openingBalance -= Number(pay.amount);
      } else if (payDate >= startDate && payDate <= endDate) {
        transactions.push({
          id: pay.id,
          date: payDate,
          type: 'payment',
          description: `Paiement - ${pay.paymentMethod}`,
          reference: pay.referenceId || pay.id.substring(0, 8),
          debit: 0,
          credit: Number(pay.amount),
        });
      }
    }

    // Sort chronologically
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate closing balance
    let currentBalance = openingBalance;
    const enrichedTransactions = transactions.map(t => {
      currentBalance += t.debit;
      currentBalance -= t.credit;
      return {
        ...t,
        balance: currentBalance
      };
    });

    const statement = {
      studentId,
      period: { startDate, endDate },
      openingBalance,
      closingBalance: currentBalance,
      transactions: enrichedTransactions
    };

    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
