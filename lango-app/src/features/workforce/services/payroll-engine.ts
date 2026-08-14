/**
 * Payroll & Workforce engine.
 *
 * Pure, deterministic composition of: salary structures (versioned components),
 * approved adjustments, join/end-date proration + unpaid leave, monetary
 * awards, salary-advance recovery, Morocco statutory contributions/taxes (via
 * `ma-regulation-adapter`), ordered rounding, minimum-net protection and
 * employer costs. Every step is emitted into a deterministic trace suitable for
 * `payroll_calculation_traces`.
 *
 * All money is exact integer minor units (dirham cents). No floats, no eval.
 *
 * `calculatePayslipLine` is kept as a backward-compatible shim over this engine
 * so existing routes (`/api/hr/payroll/periods/[id]/calculate`) and tests keep
 * working unchanged.
 */

import { compileFormula, evaluateFormula, referencedVariables, FormulaError, Money, mulBp, divInt } from './expression-engine';
import { MoroccoV1RuleConfig, computeStatutory, MOROCCO_V1_DEFAULT_RULE_CONFIG, parseRegulationConfig } from './ma-regulation-adapter';
import { moneyToCents } from '@/libs/finance/money';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type ComponentType = 'earning' | 'deduction' | 'employer' | 'info';
export type ValueType = 'fixed' | 'percent' | 'formula';
export type RoundingMode = 'half_up' | 'truncate' | 'floor' | 'ceiling';

export type ComponentLike = {
  code: string;
  label?: string;
  componentType: ComponentType;
  valueType: ValueType;
  /** DH decimal string ("6000.00"), bigint (cents) or number (DH). */
  fixedValue?: string | bigint | number;
  percentOf?: string;
  /** Basis points (1% = 100). */
  percentBp?: number | bigint;
  formula?: string;
  taxable: boolean;
  contributable: boolean;
  side: 'employee' | 'employer' | 'both' | 'info';
  proratable: boolean;
  recurring: boolean;
  roundingMode?: RoundingMode;
  sortOrder?: number;
  formulaVersion?: string;
};

export type AdjustmentLike = {
  code?: string;
  label?: string;
  amount: string | bigint | number;
  adjustmentType: 'earning' | 'deduction';
  taxable?: boolean;
  contributable?: boolean;
  proratable?: boolean;
  componentType?: ComponentType;
};

export type AwardLike = {
  code?: string;
  label?: string;
  amount: string | bigint | number;
  taxable?: boolean;
  contributable?: boolean;
};

export type Proration = { earnedDays: number; totalDays: number };

export type EngineInput = {
  regulation?: MoroccoV1RuleConfig | string;
  components?: ComponentLike[];
  adjustments?: AdjustmentLike[];
  awards?: AwardLike[];
  advanceRecoveries?: Array<{ label: string; amountCents: Money }>;
  proration?: Proration | null;
  unpaidLeaveDays?: number;
  dependantsCount?: number;
  minNetCents?: Money | null;
  onDate?: string;
};

export type EngineLine = {
  code: string;
  label: string;
  lineType: ComponentType;
  amountCents: Money;
  baseCents: Money | null;
  rateBp: number | null;
  quantity: string | null;
  formulaVersion: string | null;
};

export type TraceStep = {
  step: string;
  componentCode: string | null;
  label: string;
  baseCents: string | null;
  rateBp: number | null;
  quantity: string | null;
  resultCents: string;
  formulaVersion: string | null;
};

export type EngineResult = {
  lines: EngineLine[];
  grossCents: Money;
  contributionBaseCents: Money;
  taxBaseCents: Money;
  statutoryDeductionsCents: Money;
  nonStatutoryDeductionsCents: Money;
  totalDeductionsCents: Money;
  netCents: Money;
  netPayableCents: Money;
  employerCostCents: Money;
  totalEmployerCostCents: Money;
  minNetShortfallCents: Money;
  trace: TraceStep[];
  ruleKey: string;
  roundingOrder: string[];
};

export type JsonSafe<T> = T extends bigint
  ? string
  : T extends Array<infer U>
    ? JsonSafe<U>[]
    : T extends object
      ? { [K in keyof T]: JsonSafe<T[K]> }
      : T;

/** Convert exact-money BigInts to decimal strings before persisting as JSONB. */
export function serializeEngineResult(result: EngineResult): JsonSafe<EngineResult> {
  return JSON.parse(
    JSON.stringify(result, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value),
  ) as JsonSafe<EngineResult>;
}

// ─────────────────────────────────────────────────────────
// Money helpers
// ─────────────────────────────────────────────────────────

/** Normalize a money input (DH string, bigint cents, or number DH) to cents. */
export function toCents(value: string | bigint | number): Money {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new FormulaError(`Montant non fini: ${value}`);
    return BigInt(Math.round(value * 100));
  }
  return moneyToCents(value);
}

export function dhToNumber(cents: Money): number {
  return Number(cents) / 100;
}

/** Apply a proration rational to a money amount (half-up). */
export function applyProration(cents: Money, proration: Proration): Money {
  if (proration.totalDays <= 0) return 0n;
  if (proration.earnedDays >= proration.totalDays) return cents;
  if (proration.earnedDays <= 0) return 0n;
  return divInt(cents * BigInt(proration.earnedDays), BigInt(proration.totalDays));
}

const DAY_MS = 86_400_000;
function parseDay(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}
function dayRange(periodStart: string, periodEnd: string): number {
  return Math.round((parseDay(periodEnd) - parseDay(periodStart)) / DAY_MS) + 1;
}

/** Calendar-day based proration factor honoring join/end dates and unpaid leave. */
export function computeProration(
  periodStart: string,
  periodEnd: string,
  opts: { joinDate?: string | null; endDate?: string | null; unpaidLeaveDays?: number },
): Proration {
  const totalDays = dayRange(periodStart, periodEnd);
  let activeStart = parseDay(periodStart);
  let activeEnd = parseDay(periodEnd);
  if (opts.joinDate && parseDay(opts.joinDate) > activeStart) activeStart = parseDay(opts.joinDate);
  if (opts.endDate && parseDay(opts.endDate) < activeEnd) activeEnd = parseDay(opts.endDate);
  let earnedDays = Math.max(0, Math.round((activeEnd - activeStart) / DAY_MS)) + 1;
  if (opts.unpaidLeaveDays && opts.unpaidLeaveDays > 0) earnedDays = Math.max(0, earnedDays - opts.unpaidLeaveDays);
  return { earnedDays, totalDays };
}

// ─────────────────────────────────────────────────────────
// Structure resolution (typed, cycle-detected)
// ─────────────────────────────────────────────────────────

type ResolvedComponent = { component: ComponentLike; cents: Money };

function roundMoney(cents: Money, mode: RoundingMode | undefined): Money {
  // Every money value is already integer cents; a distinct rounding mode only
  // matters for multiplication/division, which we round at the operation site.
  void mode;
  return cents;
}

function resolveStructure(components: ComponentLike[]): { byCode: Map<string, ResolvedComponent>; order: string[] } {
  const byCode = new Map<string, ResolvedComponent>();
  const index = new Map(components.map(c => [c.code, c]));
  const order: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();

  const resolve = (code: string): Money => {
    const cached = byCode.get(code);
    if (cached) return cached.cents;
    if (visiting.has(code)) {
      throw new FormulaError(`Cycle de dépendance détecté: ${[...visiting, code].join(' → ')}`);
    }
    const component = index.get(code);
    if (!component) throw new FormulaError(`Composant inconnu "${code}".`);
    visiting.add(code);
    let cents: Money;
    if (component.valueType === 'fixed') {
      if (component.fixedValue === undefined) throw new FormulaError(`Composant fixe "${code}" sans montant.`);
      cents = roundMoney(toCents(component.fixedValue), component.roundingMode);
    } else if (component.valueType === 'percent') {
      if (!component.percentOf) throw new FormulaError(`Composant "${code}" de type percent sans percentOf.`);
      const base = resolve(component.percentOf);
      const bp = BigInt(component.percentBp ?? 0);
      cents = roundMoney(mulBp(base, bp, component.roundingMode), component.roundingMode);
    } else {
      if (!component.formula) throw new FormulaError(`Composant "${code}" de type formula sans formule.`);
      const ast = compileFormula(component.formula);
      const env: Record<string, Money> = {};
      for (const name of referencedVariables(ast)) {
        if (name === code) throw new FormulaError(`Composant "${code}" se référence lui-même.`);
        env[name] = resolve(name);
      }
      cents = roundMoney(evaluateFormula(ast, env), component.roundingMode);
    }
    visiting.delete(code);
    byCode.set(code, { component, cents });
    done.add(code);
    order.push(code);
    return cents;
  };

  for (const c of components) {
    if (!done.has(c.code)) resolve(c.code);
  }
  return { byCode, order };
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

export function runPayrollEngine(input: EngineInput): EngineResult {
  const regulation = typeof input.regulation === 'string' ? parseRegulationConfig(input.regulation) : (input.regulation ?? MOROCCO_V1_DEFAULT_RULE_CONFIG);
  const onDate = input.onDate ?? regulation.effectiveFrom;
  const components = input.components ?? [];
  const proration = input.proration ?? null;

  const trace: TraceStep[] = [];
  const push = (step: string, line: { code: string | null; label: string; baseCents: Money | null; rateBp: number | null; quantity: string | null; resultCents: Money; formulaVersion: string | null }) => {
    trace.push({
      step,
      componentCode: line.code,
      label: line.label,
      baseCents: line.baseCents === null ? null : line.baseCents.toString(),
      rateBp: line.rateBp,
      quantity: line.quantity,
      resultCents: line.resultCents.toString(),
      formulaVersion: line.formulaVersion,
    });
  };

  const scaleIfProratable = (component: ComponentLike, cents: Money): Money =>
    component.proratable && proration ? applyProration(cents, proration) : cents;

  // 1. Resolve structure (unscaled) — cycle detection happens here.
  const { byCode, order } = resolveStructure(components);

  // 2. Adjustments mutate their target component's unscaled value (or become a
  //    standalone line). Proration is applied to the final value at line build.
  const adjDeltas = new Map<string, Money>();
  const adjustmentLines: EngineLine[] = [];
  const adjustments = input.adjustments ?? [];
  for (const adj of adjustments) {
    const amount = toCents(adj.amount);
    const signed = adj.adjustmentType === 'earning' ? amount : -amount;
    if (adj.code && byCode.has(adj.code)) {
      adjDeltas.set(adj.code, (adjDeltas.get(adj.code) ?? 0n) + signed);
    } else {
      const lineType: ComponentType = adj.componentType ?? (adj.adjustmentType === 'earning' ? 'earning' : 'deduction');
      const scaled = scaleIfProratable({ proratable: adj.proratable ?? true } as ComponentLike, signed);
      adjustmentLines.push({ code: adj.code ?? 'ADJ', label: adj.label ?? 'Ajustement', lineType, amountCents: scaled, baseCents: null, rateBp: null, quantity: null, formulaVersion: null });
      push('adjustment', { code: adj.code ?? 'ADJ', label: adj.label ?? 'Ajustement', baseCents: null, rateBp: null, quantity: null, resultCents: scaled, formulaVersion: null });
    }
  }

  // 3. Build the final scaled structure lines (resolved + adjustments).
  const structureLines: EngineLine[] = [];
  for (const code of order) {
    const { component, cents } = byCode.get(code)!;
    const delta = adjDeltas.get(code) ?? 0n;
    const final = cents + delta < 0n ? 0n : cents + delta;
    const scaled = scaleIfProratable(component, final);
    structureLines.push({
      code: component.code,
      label: component.label ?? component.code,
      lineType: component.componentType,
      amountCents: scaled,
      baseCents: component.valueType === 'percent' ? byCode.get(component.percentOf ?? '')?.cents ?? null : null,
      rateBp: component.valueType === 'percent' ? Number(component.percentBp ?? 0) : null,
      quantity: null,
      formulaVersion: component.formulaVersion ?? null,
    });
    push('structure', { code: component.code, label: component.label ?? component.code, baseCents: null, rateBp: null, quantity: null, resultCents: scaled, formulaVersion: component.formulaVersion ?? null });
    if (delta !== 0n) {
      push('adjustment', { code: component.code, label: `Ajustement ${component.code}`, baseCents: null, rateBp: null, quantity: null, resultCents: delta, formulaVersion: null });
    }
  }

  // 4. Awards as taxable earnings (not prorated by default).
  const awardLines: EngineLine[] = [];
  const awards = input.awards ?? [];
  for (const award of awards) {
    const cents = toCents(award.amount);
    awardLines.push({ code: award.code ?? 'AWARD', label: award.label ?? 'Récompense', lineType: 'earning', amountCents: cents, baseCents: null, rateBp: null, quantity: null, formulaVersion: null });
    push('award', { code: award.code ?? 'AWARD', label: award.label ?? 'Récompense', baseCents: null, rateBp: null, quantity: null, resultCents: cents, formulaVersion: null });
  }

  // 5. Aggregate earnings / contribution base / tax base from the final lines.
  let grossCents = 0n;
  let contributionBaseCents = 0n;
  let taxBaseCents = 0n;
  for (const line of [...structureLines, ...awardLines, ...adjustmentLines]) {
    if (line.lineType !== 'earning') continue;
    if (line.amountCents < 0n) continue;
    grossCents += line.amountCents;
    const component = line.code ? byCode.get(line.code)?.component : undefined;
    const contributable = component ? component.contributable : true;
    const taxable = component ? component.taxable : true;
    if (contributable) contributionBaseCents += line.amountCents;
    if (taxable) taxBaseCents += line.amountCents;
  }

  // 5. Statutory contributions/taxes.
  const stat = computeStatutory(regulation, {
    contributionBaseCents,
    taxBaseCents,
    dependantsCount: input.dependantsCount ?? 0,
    onDate,
  });
  trace.push(...stat.steps.map(s => ({
    step: s.step, componentCode: null, label: s.step, baseCents: s.baseCents, rateBp: s.rateBp ?? null, quantity: null, resultCents: s.resultCents, formulaVersion: s.formulaVersion,
  })));

  const statutoryDeductions = stat.cnssEmployeeCents + stat.amoEmployeeCents + stat.irMonthlyCents;

  // 6. Non-statutory deductions: deduction components (post-proration) +
  //    advance recoveries.
  const deductionComponents: EngineLine[] = [];
  for (const line of [...structureLines, ...adjustmentLines]) {
    if (line.lineType === 'deduction' && line.amountCents > 0n) {
      deductionComponents.push(line);
    } else if (line.lineType === 'deduction' && line.amountCents < 0n) {
      deductionComponents.push({ ...line, amountCents: -line.amountCents });
    }
  }
  const recoveries: Array<{ label: string; amountCents: Money }> = input.advanceRecoveries ?? [];
  let nonStatutoryDeductions = 0n;
  for (const d of deductionComponents) {
    nonStatutoryDeductions += d.amountCents;
    push('deduction', { code: d.code, label: d.label, baseCents: null, rateBp: null, quantity: null, resultCents: d.amountCents, formulaVersion: null });
  }
  for (const r of recoveries) {
    nonStatutoryDeductions += r.amountCents;
    push('advanceRecovery', { code: 'ADV_RECOVERY', label: r.label, baseCents: null, rateBp: null, quantity: null, resultCents: r.amountCents, formulaVersion: null });
  }

  let netCents = grossCents - statutoryDeductions - nonStatutoryDeductions;

  // 7. Minimum-net protection: clamp non-statutory deductions (advance
  //    recoveries first) so net never falls below the guaranteed minimum,
  //    unless even gross after statutory deductions is below the floor.
  const minNetRaw = input.minNetCents ?? regulation.netProtection.minMonthlyCents ?? null;
  const minNet = minNetRaw === null ? null : BigInt(minNetRaw);
  let minNetShortfall = 0n;
  if (minNet !== null && netCents < minNet) {
    const afterStatutory = grossCents - statutoryDeductions;
    if (afterStatutory >= minNet) {
      let shortfall = minNet - netCents;
      const orderToCut = [...recoveries.map((r, i) => ({ i, cents: r.amountCents, kind: 'recovery' as const })), ...deductionComponents.map((d, i) => ({ i, cents: d.amountCents, kind: 'deduction' as const }))];
      for (const item of orderToCut) {
        if (shortfall <= 0n) break;
        const cut = item.cents < shortfall ? item.cents : shortfall;
        nonStatutoryDeductions -= cut;
        shortfall -= cut;
      }
      netCents = grossCents - statutoryDeductions - nonStatutoryDeductions;
      minNetShortfall = minNet - netCents;
      push('minNetProtection', { code: null, label: `Protection de salaire minimum appliquée (${moneyToDh(minNet)} DH)`, baseCents: null, rateBp: null, quantity: null, resultCents: netCents, formulaVersion: null });
    }
  }

  // 8. Employer costs.
  const employerComponents: EngineLine[] = [];
  for (const line of [...structureLines, ...adjustmentLines]) {
    if (line.lineType === 'employer') {
      employerComponents.push({ ...line, amountCents: line.amountCents < 0n ? -line.amountCents : line.amountCents });
    }
  }
  let employerCostCents = stat.employerCostCents;
  for (const e of employerComponents) {
    employerCostCents += e.amountCents;
    push('employerComponent', { code: e.code, label: e.label, baseCents: null, rateBp: null, quantity: null, resultCents: e.amountCents, formulaVersion: null });
  }

  const totalEmployerCostCents = grossCents + employerCostCents;
  const lines: EngineLine[] = [
    ...structureLines,
    ...adjustmentLines,
    ...awardLines,
    { code: 'CNSS_EMP', label: 'CNSS (salarié)', lineType: 'deduction', amountCents: stat.cnssEmployeeCents, baseCents: stat.bases.cnssCappedBaseCents, rateBp: regulation.cnss.employeeRateBp, quantity: null, formulaVersion: stat.ruleKey },
    { code: 'AMO_EMP', label: 'AMO (salarié)', lineType: 'deduction', amountCents: stat.amoEmployeeCents, baseCents: contributionBaseCents, rateBp: regulation.amo.employeeRateBp, quantity: null, formulaVersion: stat.ruleKey },
    { code: 'IR', label: 'Impôt sur le revenu', lineType: 'deduction', amountCents: stat.irMonthlyCents, baseCents: stat.bases.annualNetTaxableCents, rateBp: null, quantity: null, formulaVersion: stat.ruleKey },
    ...deductionComponents,
    ...recoveries.map(r => ({ code: 'ADV_RECOVERY', label: r.label, lineType: 'deduction' as const, amountCents: r.amountCents, baseCents: null, rateBp: null, quantity: null, formulaVersion: null })),
    ...employerComponents,
    { code: 'CNSS_EMPLOYER', label: 'CNSS (patronal)', lineType: 'employer', amountCents: stat.cnssEmployerCents, baseCents: stat.bases.cnssCappedBaseCents, rateBp: regulation.cnss.employerRateBp, quantity: null, formulaVersion: stat.ruleKey },
    { code: 'AMO_EMPLOYER', label: 'AMO (patronal)', lineType: 'employer', amountCents: stat.amoEmployerCents, baseCents: contributionBaseCents, rateBp: regulation.amo.employerRateBp, quantity: null, formulaVersion: stat.ruleKey },
  ];

  const totalDeductions = statutoryDeductions + nonStatutoryDeductions;
  return {
    lines,
    grossCents,
    contributionBaseCents,
    taxBaseCents,
    statutoryDeductionsCents: statutoryDeductions,
    nonStatutoryDeductionsCents: nonStatutoryDeductions,
    totalDeductionsCents: totalDeductions,
    netCents,
    netPayableCents: netCents,
    employerCostCents,
    totalEmployerCostCents,
    minNetShortfallCents: minNetShortfall,
    trace,
    ruleKey: stat.ruleKey,
    roundingOrder: regulation.roundingOrder,
  };
}

function moneyToDh(cents: Money): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────
// Backward-compatible shim (legacy shape, DH numbers)
// ─────────────────────────────────────────────────────────

export type PayrollInput = { grossMonthlySalary: number };
export type PayrollResult = {
  grossSalary: number;
  cnssEmployee: number;
  amoEmployee: number;
  irTax: number;
  netSalary: number;
  cnssEmployer: number;
  amoEmployer: number;
  totalEmployerCost: number;
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

export function calculatePayslipLine(input: PayrollInput): PayrollResult {
  const { grossMonthlySalary: gross } = input;
  if (gross < 0) throw new RangeError(`grossMonthlySalary must be >= 0, got ${gross}`);
  const config = MOROCCO_V1_DEFAULT_RULE_CONFIG;
  const grossCents = BigInt(Math.round(gross * 100));
  const stat = computeStatutory(config, { contributionBaseCents: grossCents, taxBaseCents: grossCents, dependantsCount: 0, onDate: config.effectiveFrom });
  const netCents = grossCents - stat.cnssEmployeeCents - stat.amoEmployeeCents - stat.irMonthlyCents;
  const toDh = (c: Money) => Number(c) / 100;
  return {
    grossSalary: toDh(grossCents),
    cnssEmployee: toDh(stat.cnssEmployeeCents),
    amoEmployee: toDh(stat.amoEmployeeCents),
    irTax: toDh(stat.irMonthlyCents),
    netSalary: toDh(netCents),
    cnssEmployer: toDh(stat.cnssEmployerCents),
    amoEmployer: toDh(stat.amoEmployerCents),
    totalEmployerCost: toDh(grossCents + stat.employerCostCents),
    snapshot: {
      grossSalary: toDh(grossCents),
      cnssCappedBase: toDh(stat.bases.cnssCappedBaseCents),
      cnssEmployee: toDh(stat.cnssEmployeeCents),
      amoEmployee: toDh(stat.amoEmployeeCents),
      annualGross: toDh(stat.bases.annualGrossCents),
      proAbatement: toDh(stat.bases.proAbatementCents),
      annualNetTaxable: toDh(stat.bases.annualNetTaxableCents),
      irAnnual: toDh(stat.irAnnualCents),
      irMonthly: toDh(stat.irMonthlyCents),
      netSalary: toDh(netCents),
      cnssEmployer: toDh(stat.cnssEmployerCents),
      amoEmployer: toDh(stat.amoEmployerCents),
      totalEmployerCost: toDh(grossCents + stat.employerCostCents),
    },
  };
}
