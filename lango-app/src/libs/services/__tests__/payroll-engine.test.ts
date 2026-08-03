import { describe, expect, it } from 'vitest';
import { calculatePayslipLine } from '../payroll-engine';

// ─────────────────────────────────────────────────────────
// Moroccan Statutory Payroll Engine — Unit Tests
// All expected values computed by hand against CGI 2024 + CNSS tables.
// ─────────────────────────────────────────────────────────

describe('calculatePayslipLine', () => {
  // ── Case 1: Standard salary BELOW CNSS cap ──────────────────────────────
  // Gross = 5 000 DH/month (< 6 000 cap)
  // CNSS emp  = 5 000 × 4.48% = 224.00
  // AMO emp   = 5 000 × 2.26% = 113.00
  // Annual gross   = 60 000
  // Pro abatement  = max(60 000 × 40%, min=2 160, max=30 000) = 24 000
  // Annual CNSS    = 224 × 12 = 2 688
  // Net taxable/yr = 60 000 − 2 688 − 24 000 = 33 312
  // IR bracket: 33 312 → rate 10%, deduction 3 000 → 33 312 × 10% − 3 000 = 331.20
  // IR monthly = 331.20 / 12 = 27.60
  // Net = 5 000 − 224 − 113 − 27.60 = 4 635.40
  it('calculates correctly below CNSS cap (gross=5000)', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 5_000 });
    expect(r.cnssEmployee).toBe(224.0);
    expect(r.amoEmployee).toBe(113.0);
    expect(r.irTax).toBe(27.6);
    expect(r.netSalary).toBe(4_635.4);
  });

  // ── Case 2: Salary ABOVE CNSS cap ───────────────────────────────────────
  // Gross = 10 000 DH/month (> 6 000 cap)
  // CNSS emp  = 6 000 × 4.48% = 268.80  ← CAPPED
  // AMO emp   = 10 000 × 2.26% = 226.00
  // Annual gross   = 120 000
  // Pro abatement  = min(120 000 × 40%, 30 000) = 30 000  ← MAX CAP
  // Annual CNSS    = 268.80 × 12 = 3 225.60
  // Net taxable/yr = 120 000 − 3 225.60 − 30 000 = 86 774.40
  // IR bracket: 86 774.40 → rate 34%, deduction 17 200 → 86 774.40 × 34% − 17 200 = 12 303.30
  // IR monthly = 12 303.30 / 12 = 1 025.27 (round2)
  // Net = 10 000 − 268.80 − 226.00 − 1 025.28 = 8 479.92 (rounding)
  it('caps CNSS at 6000 DH gross threshold', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 10_000 });
    expect(r.cnssEmployee).toBe(268.8);
    expect(r.amoEmployee).toBe(226.0);
    // CNSS cap should be 6000
    expect(r.snapshot.cnssCappedBase).toBe(6_000);
  });

  // ── Case 3: Zero gross ───────────────────────────────────────────────────
  it('returns all zeros for gross=0', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 0 });
    expect(r.cnssEmployee).toBe(0);
    expect(r.amoEmployee).toBe(0);
    expect(r.irTax).toBe(0);
    expect(r.netSalary).toBe(0);
    expect(r.totalEmployerCost).toBe(0);
  });

  // ── Case 4: Negative gross throws ────────────────────────────────────────
  it('throws RangeError for negative gross', () => {
    expect(() => calculatePayslipLine({ grossMonthlySalary: -100 })).toThrow(RangeError);
  });

  // ── Case 5: IR zero bracket (low income, no tax) ─────────────────────────
  // Gross = 2 000 DH/month
  // Annual gross = 24 000 ≤ 30 000 bracket → IR = 0
  it('applies zero IR for very low income (gross=2000)', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 2_000 });
    expect(r.irTax).toBe(0);
    expect(r.netSalary).toBeGreaterThan(0);
  });

  // ── Case 6: Employer contributions correctly computed ────────────────────
  // Gross = 5 000 → capped base = 5 000
  // CNSS employer = 5 000 × 8.98% = 449.00
  // AMO employer  = 5 000 × 3.26% = 163.00
  // Total employer cost = 5 000 + 449 + 163 = 5 612.00
  it('correctly computes employer contributions (gross=5000)', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 5_000 });
    expect(r.cnssEmployer).toBe(449.0);
    expect(r.amoEmployer).toBe(163.0);
    expect(r.totalEmployerCost).toBe(5_612.0);
  });

  // ── Case 7: Professional abatement minimum is respected ──────────────────
  // Gross = 600 DH/month
  // Annual gross = 7 200
  // Raw abatement = 7 200 × 40% = 2 880 > min 2 160, < max 30 000 → 2 880
  it('professional abatement uses raw 40% when between min/max', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 600 });
    expect(r.snapshot.proAbatement).toBe(2_880);
  });

  // ── Case 8: Snapshot contains all required fields ────────────────────────
  it('snapshot contains all required fields', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 8_000 });
    const requiredFields = [
      'grossSalary', 'cnssCappedBase', 'cnssEmployee', 'amoEmployee',
      'annualGross', 'proAbatement', 'annualNetTaxable', 'irAnnual',
      'irMonthly', 'netSalary', 'cnssEmployer', 'amoEmployer', 'totalEmployerCost',
    ];
    for (const field of requiredFields) {
      expect(r.snapshot).toHaveProperty(field);
    }
  });
});
