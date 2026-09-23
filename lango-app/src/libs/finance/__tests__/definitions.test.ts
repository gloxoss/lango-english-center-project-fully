import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  COLLECTED_PAYMENT_STATUSES,
  INVOICED_INVOICE_STATUSES,
  OVERDUE_INVOICE_STATUSES,
  isCollectedPayment,
  isInvoicedInvoice,
  isOverdueInvoice,
} from '@/libs/finance/definitions';

// Audit 2026-09-22 P0-1: the dashboard counted refunded payments as collected
// (filter was `!= 'reversed'`) and draft/credited invoices as invoiced or
// overdue (filter was `!= 'cancelled'`). These tests pin the corrected
// definitions; the dashboard route consumes the same constants.

describe('Finance money definitions (audit 2026-09-22 P0-1)', () => {
  it('counts a refunded payment as NOT collected', () => {
    expect(isCollectedPayment('refunded')).toBe(false);
  });

  it('counts a reversed payment as NOT collected', () => {
    expect(isCollectedPayment('reversed')).toBe(false);
  });

  it('counts a posted payment as collected', () => {
    expect(isCollectedPayment('posted')).toBe(true);
  });

  it('counts a draft invoice as NOT invoiced', () => {
    expect(isInvoicedInvoice('draft')).toBe(false);
  });

  it('counts a credited invoice as NOT invoiced and NOT overdue', () => {
    expect(isInvoicedInvoice('credited')).toBe(false);
    expect(isOverdueInvoice('credited', '2020-01-01', '2026-09-22')).toBe(false);
  });

  it('counts a cancelled invoice as NOT invoiced and NOT overdue', () => {
    expect(isInvoicedInvoice('cancelled')).toBe(false);
    expect(isOverdueInvoice('cancelled', '2020-01-01', '2026-09-22')).toBe(false);
  });

  it('counts every issued invoice state as invoiced', () => {
    for (const status of ['pending', 'partial', 'overdue', 'paid']) {
      expect(isInvoicedInvoice(status)).toBe(true);
    }
    expect(INVOICED_INVOICE_STATUSES).toHaveLength(4);
  });

  it('does not count a paid invoice as overdue even past its due date', () => {
    expect(isOverdueInvoice('paid', '2020-01-01', '2026-09-22')).toBe(false);
  });

  it('does not count an owed invoice as overdue before its due date', () => {
    expect(isOverdueInvoice('pending', '2099-01-01', '2026-09-22')).toBe(false);
    expect(isOverdueInvoice('partial', '2099-01-01', '2026-09-22')).toBe(false);
  });

  it('counts an owed invoice past its due date as overdue', () => {
    expect(isOverdueInvoice('pending', '2026-09-21', '2026-09-22')).toBe(true);
    expect(isOverdueInvoice('partial', '2026-09-21', '2026-09-22')).toBe(true);
    expect(isOverdueInvoice('overdue', '2026-09-21', '2026-09-22')).toBe(true);
    expect(OVERDUE_INVOICE_STATUSES).toHaveLength(3);
  });

  it('dashboard summary route consumes these definitions, not ad-hoc status filters', () => {
    // Tripwire (nav-parity style source scan): the route must route its money
    // numbers through the shared definitions and must not regress to
    // `!= 'reversed'` / `!= 'cancelled'` filters.
    const routePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../app/api/dashboard/summary/route.ts',
    );
    const source = readFileSync(routePath, 'utf8');
    expect(source).toContain('collectedPaymentCondition(payments.status)');
    expect(source).toContain('invoicedInvoiceCondition(invoices.status)');
    expect(source).toContain('overdueInvoiceCondition(invoices.status');
    expect(source).not.toMatch(/!=\s*'reversed'/);
    expect(source).not.toMatch(/!=\s*'cancelled'/);
    expect(source).not.toMatch(/NOT IN \('paid', 'cancelled', 'draft'\)/);
  });
});
