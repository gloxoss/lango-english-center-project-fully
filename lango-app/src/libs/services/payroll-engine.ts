/**
 * Moroccan statutory payroll gross-to-net engine.
 *
 * Stateless pure function — no DB access, no side effects.
 * All amounts are in Moroccan Dirhams (DH).
 *
 * References:
 *   - CNSS: Dahir n° 1-72-184, taux 4.48% salarié, 8.98% patronal, plafond 6 000 DH/mois
 *   - AMO: taux 2.26% salarié, 3.26% patronal (illimité)
 *   - IR: Code Général des Impôts, barème 2024, abattement 40% frais professionnels
 */

// ─────────────────────────────────────────────────────────
// IR Tax Brackets (annual net taxable income in DH)
// Source: CGI 2024 - Article 73
// ─────────────────────────────────────────────────────────
const IR_BRACKETS: Array<{ max: number; rate: number; deduction: number }> = [
  { max: 30_000, rate: 0, deduction: 0 },
  { max: 50_000, rate: 0.1, deduction: 3_000 },
  { max: 60_000, rate: 0.2, deduction: 8_000 },
  { max: 80_000, rate: 0.3, deduction: 14_000 },
  { max: 180_000, rate: 0.34, deduction: 17_200 },
  { max: Infinity, rate: 0.38, deduction: 24_400 },
];

/** CNSS cap: only contributions on the first 6 000 DH of gross per month */
const CNSS_MONTHLY_CAP = 6_000;

/** Statutory rates */
const CNSS_EMP_RATE = 0.0448;
const AMO_EMP_RATE = 0.0226;
const CNSS_EMPLOYER_RATE = 0.0898;
const AMO_EMPLOYER_RATE = 0.0326;

/** Professional expenses abatement: 40% of gross, min 2 160 DH/yr, max 30 000 DH/yr */
const PRO_ABATEMENT_RATE = 0.4;
const PRO_ABATEMENT_MIN_ANNUAL = 2_160;
const PRO_ABATEMENT_MAX_ANNUAL = 30_000;

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type PayrollInput = {
  grossMonthlySalary: number;
};

export type PayrollResult = {
  grossSalary: number;
  cnssEmployee: number;
  amoEmployee: number;
  irTax: number;
  netSalary: number;
  cnssEmployer: number;
  amoEmployer: number;
  totalEmployerCost: number;
  /** Full calculation trace for the calculation_snapshot JSON column */
  snapshot: {
    grossSalary: number;
    cnssCappedBase: number;
    cnssEmployee: number;
    amoEmployee: number;
    annualGross: number;
    proAbatement: number;
    annualNetTaxable: number;
    irAnnual: number;
    irMonthly: number;
    netSalary: number;
    cnssEmployer: number;
    amoEmployer: number;
    totalEmployerCost: number;
  };
};

// ─────────────────────────────────────────────────────────
// Helper: Progressive IR on annual taxable income
// ─────────────────────────────────────────────────────────
function computeIrAnnual(annualNetTaxable: number): number {
  for (const bracket of IR_BRACKETS) {
    if (annualNetTaxable <= bracket.max) {
      return Math.max(0, annualNetTaxable * bracket.rate - bracket.deduction);
    }
  }
  // Never reached (last bracket has Infinity max) but satisfies TS
  return 0;
}

// ─────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────

/**
 * Calculate Moroccan gross-to-net payroll for one employee for one month.
 *
 * @example
 *   const result = calculatePayslipLine({ grossMonthlySalary: 10_000 });
 *   // result.cnssEmployee ≈ 268.80  (6000 × 4.48%)
 *   // result.amoEmployee  ≈ 226.00  (10000 × 2.26%)
 */
export function calculatePayslipLine(input: PayrollInput): PayrollResult {
  const { grossMonthlySalary: gross } = input;

  if (gross < 0) {
    throw new RangeError(`grossMonthlySalary must be >= 0, got ${gross}`);
  }

  // 1. CNSS — capped at CNSS_MONTHLY_CAP
  const cnssCappedBase = Math.min(gross, CNSS_MONTHLY_CAP);
  const cnssEmployee = round2(cnssCappedBase * CNSS_EMP_RATE);

  // 2. AMO — no cap
  const amoEmployee = round2(gross * AMO_EMP_RATE);

  // 3. IR — progressive on annual net taxable income
  //    Net taxable = Gross − CNSS_emp − professional abatement
  const annualGross = gross * 12;
  const rawAbatement = annualGross * PRO_ABATEMENT_RATE;
  const proAbatement = Math.min(Math.max(rawAbatement, PRO_ABATEMENT_MIN_ANNUAL), PRO_ABATEMENT_MAX_ANNUAL);
  const annualCnss = cnssEmployee * 12;
  const annualNetTaxable = Math.max(0, annualGross - annualCnss - proAbatement);
  const irAnnual = computeIrAnnual(annualNetTaxable);
  const irMonthly = round2(irAnnual / 12);

  // 4. Net salary
  const netSalary = round2(gross - cnssEmployee - amoEmployee - irMonthly);

  // 5. Employer contributions
  const cnssEmployer = round2(cnssCappedBase * CNSS_EMPLOYER_RATE);
  const amoEmployer = round2(gross * AMO_EMPLOYER_RATE);
  const totalEmployerCost = round2(gross + cnssEmployer + amoEmployer);

  const snapshot = {
    grossSalary: gross,
    cnssCappedBase,
    cnssEmployee,
    amoEmployee,
    annualGross,
    proAbatement,
    annualNetTaxable,
    irAnnual,
    irMonthly,
    netSalary,
    cnssEmployer,
    amoEmployer,
    totalEmployerCost,
  };

  return {
    grossSalary: gross,
    cnssEmployee,
    amoEmployee,
    irTax: irMonthly,
    netSalary,
    cnssEmployer,
    amoEmployer,
    totalEmployerCost,
    snapshot,
  };
}

/** Round to 2 decimal places (banker's rounding omitted; centimes round half-up) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
