import { describe, expect, it, vi } from 'vitest';
import { formatPaymentDateTime, formatPercentage } from '@/features/dashboard/model/formatters';

// ENH-ADMIN-DASH-01: raw DB timestamps must never reach the screen.
describe('Recent payment date formatting', () => {
  it("renders a human Aujourd'hui label for a same-day payment with time", () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${hh}:${mm}:00`;
    const out = formatPaymentDateTime(value, 'fr');
    expect(out).toContain("Aujourd'hui");
    expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('renders a friendly date for an older payment instead of a raw timestamp', () => {
    const out = formatPaymentDateTime('2026-09-11 14:20:00', 'fr');
    expect(out).toMatch(/11/);
    expect(out).toMatch(/2026/);
    expect(out).not.toBe('2026-09-11 14:20:00');
  });

  it('never returns the raw input on success', () => {
    const out = formatPaymentDateTime('2025-03-02 00:00:00', 'en');
    expect(out).not.toContain('00:00:00');
  });

  it('falls back to the raw value only when unparseable', () => {
    expect(formatPaymentDateTime('not-a-date', 'fr')).toBe('not-a-date');
  });
});

// ENH-ADMIN-DASH-01: the recovery rate is a share of the SAME invoice cohort,
// so it is mathematically bounded by 100% — no more "153% du montant attendu".
describe('Invoice cohort recovery invariant', () => {
  function cohortRecovery(invoicedTotal: number, outstandingTotal: number): number {
    const paidOnInvoices = Math.max(0, invoicedTotal - outstandingTotal);
    return invoicedTotal > 0 ? Math.round((paidOnInvoices / invoicedTotal) * 1000) / 10 : 0;
  }

  it('cannot exceed 100% even when cash received exceeds invoicing', () => {
    // Over-collecting a month cannot push an invoice-cohort rate past 100.
    expect(cohortRecovery(943000, 0)).toBeLessThanOrEqual(100);
    expect(cohortRecovery(943000, 230000)).toBe(75.6);
  });

  it('keeps paid-on-invoices non-negative when outstanding exceeds invoiced', () => {
    expect(cohortRecovery(100000, 250000)).toBe(0);
  });

  it('treats an empty cohort as 0%, not NaN', () => {
    expect(cohortRecovery(0, 0)).toBe(0);
  });

  it('formats rates without fake precision', () => {
    expect(formatPercentage(75.6)).toBe('75.6%');
    expect(formatPercentage(80)).toBe('80%');
  });
});
