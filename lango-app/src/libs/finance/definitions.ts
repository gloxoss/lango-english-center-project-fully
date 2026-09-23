// definitions.ts
// Authoritative finance definitions for every money number the product shows.
//
// These are the single source of truth for what counts as "collected",
// "invoiced" and "overdue" (audit 2026-09-22, P0-1). Before this module the
// dashboard excluded only 'reversed' payments — silently counting refunded
// money as collected — and only 'cancelled' invoices — counting drafts as
// billing and credited invoices as receivable. Any query that reports money to
// a director MUST filter through these statuses, not through ad-hoc
// `!= 'cancelled'`-style conditions.
//
// Source enums (src/models/Schema.ts):
//   invoiceStatus = draft | pending | partial | paid | overdue | cancelled | credited
//   paymentStatus = posted | reversed | refunded

import { and, inArray, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** A payment counts as collected only when it actually stands: posted. Refunded and reversed payments are never cash in hand. */
export const COLLECTED_PAYMENT_STATUSES = ['posted'] as const;

/** An invoice counts as invoiced (billing) once it was issued to the family: pending, partial, overdue, paid. Drafts were never sent; cancelled/credited invoices are no longer owed. */
export const INVOICED_INVOICE_STATUSES = ['pending', 'partial', 'overdue', 'paid'] as const;

/** An invoice is overdue when it is still owed AND its due date has passed. Credited/cancelled/draft invoices must never be chased. */
export const OVERDUE_INVOICE_STATUSES = ['pending', 'partial', 'overdue'] as const;

export function isCollectedPayment(status: string): boolean {
  return (COLLECTED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function isInvoicedInvoice(status: string): boolean {
  return (INVOICED_INVOICE_STATUSES as readonly string[]).includes(status);
}

export function isOverdueInvoice(status: string, dueDate: string, todayIso: string): boolean {
  return (OVERDUE_INVOICE_STATUSES as readonly string[]).includes(status) && dueDate < todayIso;
}

/** SQL condition: payment row counts toward collected totals. */
export function collectedPaymentCondition(statusColumn: PgColumn): SQL {
  return inArray(statusColumn, [...COLLECTED_PAYMENT_STATUSES]);
}

/** SQL condition: invoice row counts toward invoiced totals. */
export function invoicedInvoiceCondition(statusColumn: PgColumn): SQL {
  return inArray(statusColumn, [...INVOICED_INVOICE_STATUSES]);
}

/** SQL condition: invoice row is an overdue receivable as of `today` (ISO date). */
export function overdueInvoiceCondition(statusColumn: PgColumn, dueDateColumn: PgColumn, today: string): SQL {
  return and(
    inArray(statusColumn, [...OVERDUE_INVOICE_STATUSES]),
    sql`${dueDateColumn} < ${today}`,
  ) as SQL;
}

/**
 * SQL: sum of cash actually kept from posted payments. A partially refunded
 * payment stays 'posted', so its approved refunds are netted here; a fully
 * refunded payment is already excluded by collectedPaymentCondition, so its
 * refunds are never subtracted twice. Pair with collectedPaymentCondition.
 */
export function netCollectedSumSql(payments: { amount: PgColumn }): SQL<string> {
  // Qualified on purpose: drizzle drops the table prefix when a query has a
  // single table, and an unqualified "id" inside the subquery would bind to
  // refunds.id instead of payments.id.
  return sql<string>`coalesce(sum(${payments.amount} - coalesce((
    select sum(r.amount) from refunds r
    where r.payment_id = "payments"."id" and r.tenant_id = "payments"."tenant_id" and r.status = 'approved'
  ), 0)), 0)::numeric::text`;
}
