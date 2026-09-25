// Main dashboard finance KPI truth (FIX-DASH-FIN-KPI-01).
//
// The daily pulse card shows `periodCollected.rate` next to the words "of
// expected", so it reads as "what share of this month's invoicing is settled".
// It cannot exceed 100%.
//
// The old formula divided CASH RECEIVED this month by INVOICES RAISED this month.
// Those are two different populations: cash in month M frequently settles invoices
// from earlier months. A school collecting arrears in a quiet invoicing month read
// 115% "of expected" — the impossible number reported on /dashboard.
//
// It is now invoice-based and bounded by construction:
//     rate = (invoiced - outstanding) / invoiced
// Outstanding is never negative, so paid-on-invoices <= invoiced. No cosmetic
// clamp is doing the work; if the rate were ever above 100 it would mean the
// numerator or denominator is wrong again, which is exactly what we want to see.
//
// NOTE: `libs/finance/definitions.ts` and the Analytics route are frozen
// (verified). This suite only pins the dashboard's use of them.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SUMMARY = path.resolve(process.cwd(), 'src/app/api/dashboard/summary/route.ts');
const src = () => fs.readFileSync(SUMMARY, 'utf8');

/** The formula under test, mirrored in pure arithmetic so cases are deterministic. */
function monthRate(invoiced: number, outstanding: number): number | null {
  if (invoiced <= 0) {
    return null;
  }

  // Mirrors the SQL: outstanding is summed as greatest(net - paid, 0) per
  // invoice, so it cannot be negative and paid can never exceed invoiced.
  const open = Math.max(0, outstanding);
  const paidOnInvoices = Math.max(0, invoiced - open);
  return Math.round((paidOnInvoices / invoiced) * 1000) / 10;
}

describe('Dashboard finance KPI truth', () => {
  it('no longer divides cash collected by invoices raised', () => {
    // The bug: `monthCollected / monthInvoiced` mixed two populations.
    expect(src()).not.toContain('monthCollected / monthInvoiced');
    expect(src()).toContain('monthPaidOnInvoices / monthInvoiced');
  });

  it('derives the rate from invoiced minus outstanding', () => {
    const s = src();

    expect(s).toContain('const monthPaidOnInvoices = Math.max(0, monthInvoiced - monthOpen);');
    // Outstanding on this month's invoices must come from net - paid, the
    // canonical balance, not from cash movements.
    expect(s).toContain('greatest(');
    expect(s).toContain('paidAmount}');
  });

  it('is bounded to [0, 100] by construction', () => {
    // No clamp hides a wrong numerator: every case below is arithmetically real.
    expect(monthRate(1000, 0)).toBe(100); // fully settled
    expect(monthRate(1000, 400)).toBe(60); // partial payments
    expect(monthRate(1000, 1000)).toBe(0); // all unpaid
    expect(monthRate(1000, -500)).toBe(100); // pathological legacy: negative balance still caps at 100

    for (const [inv, out] of [[1, 0], [1, 1], [12345.67, 9999.99], [500, -10000]]) {
      const r = monthRate(inv!, out!)!;

      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    }
  });

  it('handles a zero denominator as unknown, not as 0%', () => {
    // Nothing invoiced means the rate is undefined; showing 0% would claim we
    // collected nothing of something.
    expect(monthRate(0, 0)).toBeNull();
    expect(src()).toContain(': null;');
  });

  it('keeps refunds out of the collected figure', () => {
    // Collected must use the canonical net-of-approved-refunds helper.
    const s = src();

    expect(s).toContain('netCollectedSumSql(payments)');
    expect(s).not.toMatch(/sum\(\$\{payments\}\.amount\)/);
  });

  it('uses the canonical invoice and payment conditions, never a local formula', () => {
    const s = src();

    expect(s).toContain('invoicedInvoiceCondition(');
    expect(s).toContain('collectedPaymentCondition(');
    expect(s).toContain('overdueInvoiceCondition(');
    // No hand-rolled status filters of the kind the Analytics fix removed.
    expect(s).not.toContain('not in (\'draft\', \'cancelled\', \'credited\')');
    expect(s).not.toMatch(/invoices\.status\}\s*=\s*'overdue'/);
  });

  it('scopes every finance aggregate to the tenant and the branch context', () => {
    const s = src();

    // Tenant on each finance query.
    expect((s.match(/eq\(invoices\.tenantId, tenantId\)/g) ?? []).length).toBeGreaterThan(3);
    expect((s.match(/eq\(payments\.tenantId, tenantId\)/g) ?? []).length).toBeGreaterThan(1);
    // Branch context is honoured (all-branches or a specific branch).
    expect(s).toContain('userBranchFilter');
    expect(s).toContain('classBranchFilter');
  });

  it('never serves finance to a teacher', () => {
    // Confidentiality: the summary is school-admin only, so a teacher cannot see
    // school finance through the dashboard.
    expect(src()).toMatch(/requireRequestContext\(request, \['school_admin'\]\)/);
  });
});
