import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { invoices, payments, user } from '@/models/Schema';
import { ReportNotReadyError } from '../services/report-not-ready-error';

export class FeesAdapter {
  /**
   * 1. Fees Summary Report.
   */
  static async getFeesSummaryReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        studentName: user.name,
        totalAmount: invoices.amount,
        discountAmount: invoices.discountAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(eq(invoices.tenantId, tenantId));

    return list.map(i => {
      const total = Number(i.totalAmount || 0);
      const paid = Number(i.paidAmount || 0);
      const discount = Number(i.discountAmount || 0);
      const outstanding = Math.max(0, total - discount - paid);
      return {
        invoiceNumber: i.invoiceNumber,
        studentName: i.studentName,
        totalAmount: total,
        discountAmount: discount,
        paidAmount: paid,
        outstandingAmount: outstanding,
        status: i.status,
      };
    });
  }

  /**
   * 2. Receipts Report.
   */
  static async getReceiptsReport(tenantId: string, params?: any) {
    const receipts = await db
      .select({
        receiptNumber: payments.referenceId,
        paymentDate: payments.paymentDate,
        cashierName: user.name,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
      })
      .from(payments)
      .leftJoin(user, eq(payments.receivedById, user.id))
      .where(eq(payments.tenantId, tenantId));

    return receipts.map(r => ({
      receiptNumber: r.receiptNumber || 'REC-001',
      paymentDate: r.paymentDate,
      cashierName: r.cashierName || 'Caissier',
      paymentMethod: r.paymentMethod,
      amount: Number(r.amount || 0),
      isReversed: false,
    }));
  }

  /**
   * 3. Due Aging Receivables Report.
   */
  static async getDueAgingReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        studentName: user.name,
        guardianPhone: user.phone,
        totalAmount: invoices.amount,
        paidAmount: invoices.paidAmount,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.paidAmount} < ${invoices.amount}`));

    const asOf = params?.asOfDate ? new Date(params.asOfDate) : new Date();

    return list.map(item => {
      const balance = Number(item.totalAmount || 0) - Number(item.paidAmount || 0);
      const due = item.dueDate ? new Date(item.dueDate) : asOf;
      const diffDays = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      return {
        studentName: item.studentName,
        guardianContact: item.guardianPhone || 'N/A',
        currentAmount: diffDays <= 0 ? balance : 0,
        days1to30: diffDays > 0 && diffDays <= 30 ? balance : 0,
        days31to60: diffDays > 30 && diffDays <= 60 ? balance : 0,
        days61to90: diffDays > 60 && diffDays <= 90 ? balance : 0,
        days90Plus: diffDays > 90 ? balance : 0,
        totalBalance: balance,
      };
    });
  }

  /**
   * 4. Fine Assessment & Waiver Report.
   * No fines/penalty/waiver table exists anywhere in this schema (unlike
   * every other report in this file, which all have real backing tables) -
   * honestly not-ready rather than querying nonexistent data or returning
   * fake rows. See future-implementation/advanced-reporting remediation,
   * section-03.
   */
  static async getFinesReport(tenantId: string, params?: any): Promise<never> {
    throw new ReportNotReadyError('Le suivi des pénalités n\'a pas encore de modèle de données réel dans ce système.');
  }
}
