import { describe, expect, it } from 'vitest';
import {
  calculatePayslipLine,
  runPayrollEngine,
  serializeEngineResult,
  computeProration,
  toCents,
} from '../payroll-engine';
import {
  compileFormula,
  evaluateFormula,
  referencedVariables,
  FormulaError,
  mulBp,
  divInt,
} from '../expression-engine';
import {
  computeStatutory,
  parseRegulationConfig,
  resolveRegulationVersions,
  MOROCCO_V1_DEFAULT_RULE_CONFIG,
  RegulationError,
} from '../ma-regulation-adapter';

const SALARY = {
  code: 'SALARY',
  label: 'Salaire de base',
  componentType: 'earning' as const,
  valueType: 'fixed' as const,
  fixedValue: '5000.00',
  taxable: true,
  contributable: true,
  side: 'both' as const,
  proratable: true,
  recurring: true,
};

describe('expression engine', () => {
  it('parses and evaluates a+b*min(c,2)', () => {
    const ast = compileFormula('BASE + ALLOW * min(BONUS, 2)');
    expect(referencedVariables(ast).size).toBe(3);
    const env = { BASE: 100n, ALLOW: 200n, BONUS: 1n };
    expect(evaluateFormula(ast, env)).toBe(300n);
  });

  it('rejects eval-style and unsafe tokens', () => {
    expect(() => compileFormula('eval(1)')).toThrow(FormulaError);
    expect(() => compileFormula('3.14 * 2')).toThrow(FormulaError); // no decimals
    expect(() => compileFormula('x = 1')).toThrow(FormulaError); // no assignments
    expect(() => compileFormula('power(BASE,2)')).toThrow(FormulaError); // no arbitrary fn
    expect(() => compileFormula('SALARY; DROP TABLE')).toThrow(FormulaError);
  });

  it('throws on unknown variables and division by zero', () => {
    const ast = compileFormula('BASE / 0');
    expect(() => evaluateFormula(ast, { BASE: 100n })).toThrow(FormulaError);
    const ast2 = compileFormula('NOPE + 1');
    expect(() => evaluateFormula(ast2, {})).toThrow(FormulaError);
  });

  it('mulBp is exact half-up cents', () => {
    expect(mulBp(500000n, 448n)).toBe(22400n); // 5000.00 × 4.48%
    expect(mulBp(100n, 2500n)).toBe(25n); // 1.00 × 25%
    expect(mulBp(1n, 50n)).toBe(0n); // 0.01 × 0.5% → 0.0005 → 0 (rounds to 0)
    expect(mulBp(1n, 50n + 10000n)).toBe(1n); // 0.01 × 100.5% → 1.005 → 1 (half-up)
  });

  it('divInt rounds half-up', () => {
    expect(divInt(1230330n, 12n)).toBe(102528n); // 12 303.30/12 → 1 025.28
    expect(divInt(1n, 2n)).toBe(1n); // 0.5 → 1
    expect(divInt(2n, 2n)).toBe(1n);
  });
});

describe('morocco regulation adapter', () => {
  it('parses the default config and rejects corrupt config', () => {
    const cfg = parseRegulationConfig(MOROCCO_V1_DEFAULT_RULE_CONFIG);
    expect(cfg.jurisdiction).toBe('MA');
    expect(cfg.cnss.employeeRateBp).toBe(448);
    expect(() => parseRegulationConfig({ jurisdiction: 'FR' })).toThrow(RegulationError);
    expect(() => parseRegulationConfig({ ...MOROCCO_V1_DEFAULT_RULE_CONFIG, ir: { brackets: [] } })).toThrow(RegulationError);
  });

  it('enforces effective-date boundaries', () => {
    const cfg = parseRegulationConfig(MOROCCO_V1_DEFAULT_RULE_CONFIG);
    expect(resolveRegulationVersions(cfg, '2025-06-01')).toBe(cfg);
    expect(() => resolveRegulationVersions(cfg, '2023-12-31')).toThrow(RegulationError);
    expect(() => resolveRegulationVersions({ ...cfg, effectiveTo: '2024-12-31' }, '2025-06-01')).toThrow(RegulationError);
  });

  it('reproduces the hand-verified statutory figures (gross 5000)', () => {
    const cfg = parseRegulationConfig(MOROCCO_V1_DEFAULT_RULE_CONFIG);
    const s = computeStatutory(cfg, { contributionBaseCents: 500000n, taxBaseCents: 500000n, dependantsCount: 0, onDate: cfg.effectiveFrom });
    expect(s.cnssEmployeeCents).toBe(22400n);
    expect(s.amoEmployeeCents).toBe(11300n);
    expect(s.irMonthlyCents).toBe(2760n);
    expect(s.cnssEmployerCents).toBe(44900n);
    expect(s.amoEmployerCents).toBe(16300n);
    expect(s.employerCostCents).toBe(61200n);
  });
});

describe('runPayrollEngine', () => {
  it('serializes exact-money results into a JSON-safe immutable snapshot', () => {
    const result = runPayrollEngine({ components: [SALARY] });
    const snapshot = serializeEngineResult(result);

    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(snapshot.grossCents).toBe('500000');
    expect(snapshot.lines[0]?.amountCents).toBe('500000');
  });

  it('computes gross/net/employer equations from a structure', () => {
    const r = runPayrollEngine({ components: [SALARY] });
    expect(r.grossCents).toBe(500000n);
    expect(r.netCents).toBe(463540n); // 5 000 − 224 − 113 − 27.60
    expect(r.netPayableCents).toBe(463540n);
    expect(r.totalEmployerCostCents).toBe(561200n); // 5 000 + 449 + 163
    expect(r.statutoryDeductionsCents).toBe(22400n + 11300n + 2760n);
  });

  it('is deterministic across identical inputs', () => {
    const a = runPayrollEngine({ components: [SALARY] });
    const b = runPayrollEngine({ components: [SALARY] });
    const ser = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
    expect(ser(a)).toBe(ser(b));
  });

  it('detects formula dependency cycles', () => {
    const a = { ...SALARY, code: 'A', formula: 'B + 100', valueType: 'formula' as const, fixedValue: undefined };
    const b = { ...SALARY, code: 'B', percentOf: 'A', percentBp: 500, valueType: 'percent' as const, fixedValue: undefined };
    expect(() => runPayrollEngine({ components: [a, b] })).toThrow(FormulaError);
  });

  it('supports percent-of and formula components', () => {
    const base = { ...SALARY, code: 'BASE', fixedValue: '4000.00' };
    const housing = { ...SALARY, code: 'HOUSING', valueType: 'percent' as const, percentOf: 'BASE', percentBp: 1000, fixedValue: undefined, label: 'Indemnité logement' };
    const allowance = { ...SALARY, code: 'ALLOW', valueType: 'formula' as const, formula: 'BASE / 2', fixedValue: undefined, label: 'Allocation' };
    const r = runPayrollEngine({ components: [base, housing, allowance] });
    // 4000 + 400 + 2000 = 6400 gross
    expect(r.grossCents).toBe(640000n);
  });

  it('applies join-date proration (half month)', () => {
    const proration = computeProration('2024-02-01', '2024-02-28', { joinDate: '2024-02-15' });
    expect(proration.totalDays).toBe(28);
    expect(proration.earnedDays).toBe(14);
    const r = runPayrollEngine({ components: [SALARY], proration });
    expect(r.grossCents).toBe(250000n);
  });

  it('reduces gross for unpaid leave', () => {
    const proration = computeProration('2024-03-01', '2024-03-31', { unpaidLeaveDays: 10 });
    expect(proration.totalDays).toBe(31);
    expect(proration.earnedDays).toBe(21);
    const r = runPayrollEngine({ components: [SALARY], proration });
    expect(r.grossCents).toBe(divInt(500000n * 21n, 31n));
  });

  it('adds adjustments, monetary awards and advance recovery', () => {
    const r = runPayrollEngine({
      components: [SALARY],
      awards: [{ label: 'Prime de performance', amount: '1000.00' }],
      adjustments: [{ code: 'SALARY', label: 'Rattrapage', amount: '500.00', adjustmentType: 'earning' }],
      advanceRecoveries: [{ label: 'Avance 2024/05', amountCents: 20000n }],
    });
    // gross = 5000 + 1000 + 500 = 6500
    expect(r.grossCents).toBe(650000n);
    expect(r.nonStatutoryDeductionsCents).toBe(20000n);
    // net must be < gross
    expect(r.netCents).toBeLessThan(r.grossCents);
  });

  it('enforces minimum-net protection by cutting advance recovery first', () => {
    const r = runPayrollEngine({
      components: [SALARY],
      advanceRecoveries: [{ label: 'Avance', amountCents: 10000n }],
      minNetCents: 460000n, // 4 600 DH
    });
    // unclamped net = 463540 − 10000 = 453540 < 460000
    // recovery cut to 3540 so net lands exactly on the floor
    expect(r.netCents).toBe(460000n);
    expect(r.nonStatutoryDeductionsCents).toBe(3540n);
    expect(r.minNetShortfallCents).toBe(0n);
  });

  it('does not clamp when the floor is already satisfied', () => {
    const r = runPayrollEngine({ components: [SALARY], minNetCents: 400000n });
    expect(r.netCents).toBe(463540n);
    expect(r.minNetShortfallCents).toBe(0n);
  });
});

describe('calculatePayslipLine backward-compat shim', () => {
  it('gross 5000: exact legacy figures', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 5_000 });
    expect(r.cnssEmployee).toBe(224.0);
    expect(r.amoEmployee).toBe(113.0);
    expect(r.irTax).toBe(27.6);
    expect(r.netSalary).toBe(4_635.4);
    expect(r.cnssEmployer).toBe(449.0);
    expect(r.amoEmployer).toBe(163.0);
    expect(r.totalEmployerCost).toBe(5_612.0);
  });

  it('gross 10000: CNSS capped', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 10_000 });
    expect(r.cnssEmployee).toBe(268.8);
    expect(r.snapshot.cnssCappedBase).toBe(6_000);
  });

  it('gross 0: all zeros; negative gross throws', () => {
    const r = calculatePayslipLine({ grossMonthlySalary: 0 });
    expect(r.netSalary).toBe(0);
    expect(() => calculatePayslipLine({ grossMonthlySalary: -100 })).toThrow(RangeError);
  });

  it('pro abatement respects min/max', () => {
    expect(calculatePayslipLine({ grossMonthlySalary: 600 }).snapshot.proAbatement).toBe(2_880);
    expect(calculatePayslipLine({ grossMonthlySalary: 10_000 }).snapshot.proAbatement).toBe(30_000);
  });
});

describe('toCents normalization', () => {
  it('accepts DH strings, bigint cents and number DH', () => {
    expect(toCents('5000.00')).toBe(500000n);
    expect(toCents(5000)).toBe(500000n);
    expect(toCents(500000n)).toBe(500000n);
  });
});
