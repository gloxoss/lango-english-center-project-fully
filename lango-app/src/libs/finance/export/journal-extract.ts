import { and, eq, gte, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getTenantCurrency } from '@/libs/finance/currency';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { invoices, payments, refunds } from '@/models/Schema';
import { paymentReversals, receipts, studentCredits } from '@/features/finance/models/student-accounting-schema';

export type StudentJournalRow = {
  date: string; // YYYY-MM-DD
  type: 'invoice' | 'payment' | 'receipt' | 'reversal' | 'refund' | 'credit';
  reference: string;
  studentId: string;
  amount: string; // canonical decimal string, e.g. "1250.00"
  direction: 'debit' | 'credit';
  currency: string;
};

export interface StudentJournalOptions {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
}

const asDate = (col: SQLWrapper) => sql`${col}::date`;

// Normalize a numeric DB amount to a canonical 2-decimal string through the
// BigInt money helpers (no float arithmetic).
function fmt(n: number): string {
  return centsToMoney(moneyToCents(String(n)));
}

/**
 * Flat, tenant-scoped journal extract of student-accounting documents:
 * invoices (charges), payments, receipts, reversals, refunds and credits.
 * Amounts are canonical decimal strings in the tenant's base currency. No
 * hard row cap (unlike the advanced-reporting adapter) — this is a full export.
 */
export async function buildStudentJournal(
  tenantId: string,
  options: StudentJournalOptions = {},
): Promise<StudentJournalRow[]> {
  const { from, to } = options;
  const currency = await getTenantCurrency(tenantId);
  const rows: StudentJournalRow[] = [];

  const range = (col: SQLWrapper): SQL[] => {
    const conds: SQL[] = [];
    if (from) conds.push(gte(asDate(col), from));
    if (to) conds.push(lte(asDate(col), to));
    return conds;
  };

  // Invoices — charges (debit).
  const invRows = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, studentId: invoices.studentId, netAmount: invoices.netAmount, issueDate: invoices.issueDate })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), ...range(invoices.issueDate)));
  for (const r of invRows) {
    rows.push({ date: r.issueDate, type: 'invoice', reference: r.invoiceNumber, studentId: r.studentId, amount: fmt(Number(r.netAmount)), direction: 'debit', currency });
  }

  // Payments — received (credit).
  const payRows = await db
    .select({ id: payments.id, studentId: payments.studentId, amount: payments.amount, paymentDate: payments.paymentDate, referenceId: payments.referenceId })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), ...range(payments.paymentDate)));
  for (const r of payRows) {
    rows.push({ date: (r.paymentDate ?? '').slice(0, 10), type: 'payment', reference: r.referenceId ?? r.id, studentId: r.studentId, amount: fmt(Number(r.amount)), direction: 'credit', currency });
  }

  // Receipts — the persisted RC- documents (credit).
  const recRows = await db
    .select({ receiptNumber: receipts.receiptNumber, studentId: receipts.studentId, amount: receipts.amount, paymentDate: receipts.paymentDate })
    .from(receipts)
    .where(and(eq(receipts.tenantId, tenantId), ...range(receipts.paymentDate)));
  for (const r of recRows) {
    rows.push({ date: r.paymentDate, type: 'receipt', reference: r.receiptNumber, studentId: r.studentId, amount: fmt(Number(r.amount)), direction: 'credit', currency });
  }

  // Reversals — undo a payment (debit), amount = the reversed payment's amount.
  const revRows = await db
    .select({
      id: paymentReversals.id,
      amount: payments.amount,
      studentId: payments.studentId,
      reversedAt: paymentReversals.reversedAt,
      createdAt: paymentReversals.createdAt,
    })
    .from(paymentReversals)
    .innerJoin(payments, eq(paymentReversals.paymentId, payments.id))
    .where(and(eq(paymentReversals.tenantId, tenantId)));
  for (const r of revRows) {
    const date = (r.reversedAt ?? r.createdAt ?? '').slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;
    rows.push({ date, type: 'reversal', reference: r.id, studentId: r.studentId, amount: fmt(Number(r.amount)), direction: 'debit', currency });
  }

  // Refunds — money back to student (debit).
  const refRows = await db
    .select({ refundNumber: refunds.refundNumber, studentId: refunds.studentId, amount: refunds.amount, createdAt: refunds.createdAt })
    .from(refunds)
    .where(and(eq(refunds.tenantId, tenantId), ...range(refunds.createdAt)));
  for (const r of refRows) {
    rows.push({ date: (r.createdAt ?? '').slice(0, 10), type: 'refund', reference: r.refundNumber, studentId: r.studentId, amount: fmt(Number(r.amount)), direction: 'debit', currency });
  }

  // Student credits — money held on account for the student (credit).
  const creditRows = await db
    .select({ id: studentCredits.id, studentId: studentCredits.studentId, amount: studentCredits.amount, createdAt: studentCredits.createdAt })
    .from(studentCredits)
    .where(and(eq(studentCredits.tenantId, tenantId), ...range(studentCredits.createdAt)));
  for (const r of creditRows) {
    rows.push({ date: (r.createdAt ?? '').slice(0, 10), type: 'credit', reference: r.id, studentId: r.studentId, amount: fmt(Number(r.amount)), direction: 'credit', currency });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}
