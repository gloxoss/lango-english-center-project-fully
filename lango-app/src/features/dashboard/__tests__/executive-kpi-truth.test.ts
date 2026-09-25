// Executive KPI truth regression suite (AUD-ANALYTICS-01).
//
// The director dashboard must agree with the modules it reads from. Two rules
// were being broken in src/app/api/analytics:
//
//   1. Money: `libs/finance/definitions.ts` is the single definition of
//      invoiced / collected / overdue, and CONTEXT.md says "never invent a local
//      formula". The KPIs rolled their own:
//        - invoiced  used `status NOT IN ('draft','cancelled','credited')`
//        - collected used `sum(amount)` where status='posted' — ignoring approved
//          REFUNFS, so the platform overstated cash kept
//        - overdue   used `status = 'overdue'`, missing every past-due invoice
//          still sitting in 'pending'/'partial'
//      Collection rate could therefore exceed 100%.
//
//   2. Business date: `d.toISOString().slice(0,10)` is the UTC day. The school
//      day is the Casablanca one (libs/finance/today.ts), which shifts every
//      30-day and month window on the dashboard during Moroccan mornings.
//
// Static checks so a KPI cannot quietly re-invent a finance formula or fall back
// to the UTC clock.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INVOICED_INVOICE_STATUSES,
  isOverdueInvoice,
  OVERDUE_INVOICE_STATUSES,
} from '@/libs/finance/definitions';
import { casablancaTodayIso } from '@/libs/finance/today';

const ANALYTICS_ROUTE = path.resolve(process.cwd(), 'src/app/api/analytics/route.ts');
const src = () => fs.readFileSync(ANALYTICS_ROUTE, 'utf8');

describe('Executive KPI truth', () => {
  it('uses the canonical finance conditions instead of local formulas', () => {
    const s = src();

    expect(s).toContain('invoicedInvoiceCondition(');
    expect(s).toContain('collectedPaymentCondition(');
    expect(s).toContain('netCollectedSumSql(');
    expect(s).toContain('overdueInvoiceCondition(');
  });

  it('never re-invents the invoiced/overdue status filter', () => {
    const s = src();

    // The two hand-rolled filters this suite exists to eliminate.
    expect(s).not.toContain('not in (\'draft\', \'cancelled\', \'credited\')');
    expect(s).not.toMatch(/invoices\.status\}\s*=\s*'overdue'/);
  });

  it('nets approved refunds out of collected money', () => {
    // A partially refunded payment stays 'posted'; counting it whole inflates
    // cash kept and can push collection rate past 100%.
    const s = src();

    expect(s).toContain('netCollectedSumSql(');
    expect(s).not.toMatch(/sum\(\$\{payments\.amount\}\)/);
  });

  it('never derives a business date from the UTC ISO string', () => {
    expect(src()).not.toContain('.toISOString().slice(0, 10)');
    expect(src()).toContain('casablancaTodayIso(');
  });

  it('clamps every displayed percentage to 0..100', () => {
    const s = src();
    // Each `* 100` style rate must be bounded; a KPI over 100% is a bug.
    const rateLines = s.split('\n').filter(l => /collectionRate|attendanceRate/.test(l) && l.includes('* 100'));
    for (const line of rateLines) {
      expect(line, `unclamped rate: ${line.trim()}`).toMatch(/Math\.min\(100|Math\.max\(0|clamp\(/);
    }

    expect(rateLines.length).toBeGreaterThan(0);
  });

  it('keeps the canonical definitions semantics it now relies on', () => {
    // Guard the contract the KPIs depend on, so a silent change upstream is loud.
    expect([...INVOICED_INVOICE_STATUSES]).toEqual(['pending', 'partial', 'overdue', 'paid']);
    expect([...OVERDUE_INVOICE_STATUSES]).toEqual(['pending', 'partial', 'overdue']);
    // Overdue is past-due AND open, not merely a status label.
    expect(isOverdueInvoice('pending', '2026-01-01', '2026-09-24')).toBe(true);
    expect(isOverdueInvoice('pending', '2026-12-31', '2026-09-24')).toBe(false);
    expect(isOverdueInvoice('paid', '2026-01-01', '2026-09-24')).toBe(false);
  });

  it('agrees with the rest of the platform on the school day', () => {
    const justPastMoroccanMidnight = new Date('2026-09-20T23:30:00.000Z');

    expect(justPastMoroccanMidnight.toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(casablancaTodayIso(justPastMoroccanMidnight)).toBe('2026-09-21');
  });
});
