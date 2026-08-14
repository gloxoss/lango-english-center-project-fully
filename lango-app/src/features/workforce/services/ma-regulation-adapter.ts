/**
 * Effective-dated Morocco (MA) statutory regulation adapter — monthly MAD V1.
 *
 * Replaces the hard-coded 2024 constants that lived in
 * `src/libs/services/payroll-engine.ts`. The adapter is a pure function of a
 * stored `rule_config` jsonb (persisted in `payroll_regulation_versions`), so a
 * law change becomes a new effective-dated version rather than a code edit.
 *
 * All arithmetic is exact integer minor units (dirham cents); every money
 * result is rounded to the cent when produced (ordered rounding) and the full
 * computation is emitted as a deterministic trace.
 *
 * This file intentionally performs no DB access and no network I/O.
 */

import { divInt, mulBp, Money, FormulaError } from './expression-engine';

export type ValidationStatus = 'unvalidated' | 'under_review' | 'validated_by_professional';

export type Provenance = {
  source: string;
  sourceUrl: string | null;
  sourceDocumentRef: string | null;
  publicationDate: string | null;
  validationStatus: ValidationStatus;
  reviewerNotes: string | null;
};

export type MoroccoV1RuleConfig = {
  jurisdiction: 'MA';
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  monthly: boolean;
  currency: 'MAD';
  cnss: { employeeRateBp: number; employerRateBp: number; monthlyCapCents: number | null };
  amo: { employeeRateBp: number; employerRateBp: number; monthlyCapCents: number | null };
  ir: {
    brackets: Array<{ maxAnnualCents: number; rateBp: number; deductionCents: number }>;
    proAbatement: { rateBp: number; minAnnualCents: number; maxAnnualCents: number };
    annualizationMonths: number;
  };
  roundingOrder: string[];
  netProtection: { minMonthlyCents: number | null };
  provenance: Provenance;
};

export type StatutoryInput = {
  /** Contribution base (sum of contributable earnings), cents. */
  contributionBaseCents: Money;
  /** Tax base (sum of taxable earnings), cents. */
  taxBaseCents: Money;
  dependantsCount: number;
  onDate: string; // ISO date, used to select the effective version
};

export type StatutoryStep = {
  step: string;
  baseCents: string;
  rateBp?: number;
  resultCents: string;
  formulaVersion: string;
};

export type StatutoryResult = {
  cnssEmployeeCents: Money;
  amoEmployeeCents: Money;
  irMonthlyCents: Money;
  netBeforeNonStatutory: Money;
  cnssEmployerCents: Money;
  amoEmployerCents: Money;
  employerCostCents: Money;
  irAnnualCents: Money;
  bases: { cnssCappedBaseCents: Money; annualGrossCents: Money; proAbatementCents: Money; annualNetTaxableCents: Money };
  steps: StatutoryStep[];
  ruleKey: string;
};

export class RegulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulationError';
  }
}

const DEFAULT_PROVENANCE: Provenance = {
  source: 'CNSS: Dahir n° 1-72-184; AMO: Loi 65-00; IR: CGI 2024 Art. 73 (abattement frais professionnels 40%)',
  sourceUrl: null,
  sourceDocumentRef: null,
  publicationDate: null,
  validationStatus: 'unvalidated',
  reviewerNotes: null,
};

export const MOROCCO_V1_DEFAULT_RULE_CONFIG: MoroccoV1RuleConfig = {
  jurisdiction: 'MA',
  effectiveFrom: '2024-01-01',
  effectiveTo: null,
  monthly: true,
  currency: 'MAD',
  cnss: { employeeRateBp: 448, employerRateBp: 898, monthlyCapCents: 600_000 },
  amo: { employeeRateBp: 226, employerRateBp: 326, monthlyCapCents: null },
  ir: {
    brackets: [
      { maxAnnualCents: 3_000_000, rateBp: 0, deductionCents: 0 },
      { maxAnnualCents: 5_000_000, rateBp: 1000, deductionCents: 300_000 },
      { maxAnnualCents: 6_000_000, rateBp: 2000, deductionCents: 800_000 },
      { maxAnnualCents: 8_000_000, rateBp: 3000, deductionCents: 1_400_000 },
      { maxAnnualCents: 18_000_000, rateBp: 3400, deductionCents: 1_720_000 },
      { maxAnnualCents: Number.POSITIVE_INFINITY, rateBp: 3800, deductionCents: 2_440_000 },
    ],
    proAbatement: { rateBp: 4000, minAnnualCents: 216_000, maxAnnualCents: 3_000_000 },
    annualizationMonths: 12,
  },
  roundingOrder: [
    'cnssEmployee', 'amoEmployee', 'cnssEmployer', 'amoEmployer',
    'irAnnual', 'irMonthly', 'net', 'totalEmployerCost',
  ],
  netProtection: { minMonthlyCents: null },
  provenance: DEFAULT_PROVENANCE,
};

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * Validate + normalize a stored rule_config jsonb into a typed rule set.
 * Unknown keys are rejected; required keys must be present and well-typed so a
 * corrupted config can never silently change payroll math.
 */
export function parseRegulationConfig(raw: unknown): MoroccoV1RuleConfig {
  if (raw === null || typeof raw !== 'object') throw new RegulationError('Config réglementaire manquante ou invalide.');
  const o = raw as Record<string, unknown>;
  if (o.jurisdiction !== 'MA') throw new RegulationError('Seule la juridiction MA est supportée.');
  if (o.monthly !== true || o.currency !== 'MAD') throw new RegulationError('Seule la paie mensuelle en MAD est supportée pour la V1.');
  if (typeof o.effectiveFrom !== 'string') throw new RegulationError('effectiveFrom requis.');

  const cnss = o.cnss as Record<string, unknown> | undefined;
  const amo = o.amo as Record<string, unknown> | undefined;
  const ir = o.ir as Record<string, unknown> | undefined;
  if (!cnss || !amo || !ir) throw new RegulationError('Sections cnss/amo/ir requises.');
  if (!isNonNegInt(cnss.employeeRateBp) || !isNonNegInt(cnss.employerRateBp)) throw new RegulationError('Taux CNSS invalides.');
  if (!isNonNegInt(amo.employeeRateBp) || !isNonNegInt(amo.employerRateBp)) throw new RegulationError('Taux AMO invalides.');

  const brackets = Array.isArray(ir.brackets) ? ir.brackets : null;
  if (!brackets || brackets.length === 0) throw new RegulationError('Barème IR requis.');
  for (let i = 0; i < brackets.length; i += 1) {
    const br = brackets[i] as Record<string, unknown>;
    const isLast = i === brackets.length - 1;
    const top = br.maxAnnualCents;
    const catchAll = top === null || top === undefined || top === Number.POSITIVE_INFINITY;
    // The final bracket may omit its cap (catch-all); JSON cannot represent
    // Infinity, so stored configs carry `null` there.
    if (!isNonNegInt(top) && !(isLast && catchAll)) throw new RegulationError('Barème IR invalide (maxAnnualCents).');
    if (!isNonNegInt(br.rateBp) || !isNonNegInt(br.deductionCents)) throw new RegulationError('Barème IR invalide (taux/déduction).');
  }
  const pa = ir.proAbatement as Record<string, unknown> | undefined;
  if (!pa || !isNonNegInt(pa.rateBp) || !isNonNegInt(pa.minAnnualCents) || !isNonNegInt(pa.maxAnnualCents)) {
    throw new RegulationError('Abattement frais professionnels invalide.');
  }

  const np = o.netProtection as Record<string, unknown> | undefined;
  const minMonthlyCents = np && np.minMonthlyCents !== null && np.minMonthlyCents !== undefined
    ? isNonNegInt(np.minMonthlyCents) ? np.minMonthlyCents : null
    : null;

  const provenanceRaw = o.provenance as Record<string, unknown> | undefined;
  const validationStatus: ValidationStatus =
    provenanceRaw?.validationStatus === 'under_review' || provenanceRaw?.validationStatus === 'validated_by_professional'
      ? provenanceRaw.validationStatus
      : 'unvalidated';

  const roundingOrder = Array.isArray(o.roundingOrder) && o.roundingOrder.every(x => typeof x === 'string')
    ? o.roundingOrder
    : MOROCCO_V1_DEFAULT_RULE_CONFIG.roundingOrder;

  return {
    jurisdiction: 'MA',
    effectiveFrom: o.effectiveFrom,
    effectiveTo: typeof o.effectiveTo === 'string' ? o.effectiveTo : null,
    monthly: true,
    currency: 'MAD',
    cnss: {
      employeeRateBp: cnss.employeeRateBp as number,
      employerRateBp: cnss.employerRateBp as number,
      monthlyCapCents: cnss.monthlyCapCents !== null && cnss.monthlyCapCents !== undefined && isNonNegInt(cnss.monthlyCapCents) ? cnss.monthlyCapCents as number : null,
    },
    amo: {
      employeeRateBp: amo.employeeRateBp as number,
      employerRateBp: amo.employerRateBp as number,
      monthlyCapCents: amo.monthlyCapCents !== null && amo.monthlyCapCents !== undefined && isNonNegInt(amo.monthlyCapCents) ? amo.monthlyCapCents as number : null,
    },
    ir: {
      brackets: brackets.map((b, i) => {
        const br = b as Record<string, unknown>;
        const top = br.maxAnnualCents;
        const isLast = i === brackets.length - 1;
        const normalized = top === null || top === undefined || top === Number.POSITIVE_INFINITY
          ? (isLast ? Number.POSITIVE_INFINITY : 0)
          : (isNonNegInt(top) ? top as number : 0);
        return { maxAnnualCents: normalized, rateBp: br.rateBp as number, deductionCents: br.deductionCents as number };
      }),
      proAbatement: { rateBp: pa.rateBp as number, minAnnualCents: pa.minAnnualCents as number, maxAnnualCents: pa.maxAnnualCents as number },
      annualizationMonths: isNonNegInt(ir.annualizationMonths) ? ir.annualizationMonths as number : 12,
    },
    roundingOrder,
    netProtection: { minMonthlyCents },
    provenance: {
      source: typeof provenanceRaw?.source === 'string' ? provenanceRaw.source : DEFAULT_PROVENANCE.source,
      sourceUrl: typeof provenanceRaw?.sourceUrl === 'string' ? provenanceRaw.sourceUrl : null,
      sourceDocumentRef: typeof provenanceRaw?.sourceDocumentRef === 'string' ? provenanceRaw.sourceDocumentRef : null,
      publicationDate: typeof provenanceRaw?.publicationDate === 'string' ? provenanceRaw.publicationDate : null,
      validationStatus,
      reviewerNotes: typeof provenanceRaw?.reviewerNotes === 'string' ? provenanceRaw.reviewerNotes : null,
    },
  };
}

function mulBpInt(cents: Money, bp: number): Money {
  return mulBp(cents, BigInt(bp));
}

/**
 * Compute the statutory gross-to-net for one monthly payslip from the two
 * contribution/tax bases. Deterministic: given identical config + bases the
 * result and trace are identical every run.
 */
export function computeStatutory(config: MoroccoV1RuleConfig, input: StatutoryInput): StatutoryResult {
  const { contributionBaseCents, taxBaseCents, dependantsCount } = input;
  const formulaVersion = config.effectiveFrom;
  const steps: StatutoryStep[] = [];
  const push = (step: string, baseCents: Money, rateBp: number | undefined, resultCents: Money) => {
    steps.push({ step, baseCents: baseCents.toString(), rateBp, resultCents: resultCents.toString(), formulaVersion });
  };

  // Contribution base is the contributable gross; CNSS is capped.
  const cnssBase = config.cnss.monthlyCapCents === null
    ? contributionBaseCents
    : (contributionBaseCents < BigInt(config.cnss.monthlyCapCents) ? contributionBaseCents : BigInt(config.cnss.monthlyCapCents));
  const cnssEmployee = mulBpInt(cnssBase, config.cnss.employeeRateBp);
  push('cnssEmployee', cnssBase, config.cnss.employeeRateBp, cnssEmployee);

  // AMO is uncapped by default.
  const amoBase = config.amo.monthlyCapCents === null
    ? contributionBaseCents
    : (contributionBaseCents < BigInt(config.amo.monthlyCapCents) ? contributionBaseCents : BigInt(config.amo.monthlyCapCents));
  const amoEmployee = mulBpInt(amoBase, config.amo.employeeRateBp);
  push('amoEmployee', amoBase, config.amo.employeeRateBp, amoEmployee);

  // IR: annualized net taxable income = (tax base − CNSS emp) × 12 months
  // after the 40% professional-expenses abatement (min/max clamped).
  const annualGross = taxBaseCents * BigInt(config.ir.annualizationMonths);
  const rawAbatement = mulBpInt(annualGross, config.ir.proAbatement.rateBp);
  const minAb = BigInt(config.ir.proAbatement.minAnnualCents);
  const maxAb = BigInt(config.ir.proAbatement.maxAnnualCents);
  const proAbatement = rawAbatement < minAb ? minAb : (rawAbatement > maxAb ? maxAb : rawAbatement);
  const annualCnss = cnssEmployee * BigInt(config.ir.annualizationMonths);
  const annualNetTaxable = annualGross - annualCnss - proAbatement < 0n ? 0n : annualGross - annualCnss - proAbatement;

  // Family charges (charge de famille) reduce the taxable base before the
  // brackets: 30 DH/month per dependent (CGI 2024). Keep it opt-in via config.
  const familyCharge = BigInt(dependantsCount > 0 ? dependantsCount * 30 : 0);
  const irAnnual = computeIrAnnual(config, annualNetTaxable - familyCharge * BigInt(config.ir.annualizationMonths), steps, push, formulaVersion);
  push('irAnnual', annualNetTaxable, undefined, irAnnual);

  const irMonthly = divInt(irAnnual, BigInt(config.ir.annualizationMonths));
  push('irMonthly', irAnnual, undefined, irMonthly);

  // Employer side.
  const cnssEmployer = mulBpInt(cnssBase, config.cnss.employerRateBp);
  push('cnssEmployer', cnssBase, config.cnss.employerRateBp, cnssEmployer);
  const amoEmployer = mulBpInt(amoBase, config.amo.employerRateBp);
  push('amoEmployer', amoBase, config.amo.employerRateBp, amoEmployer);

  const netBeforeNonStatutory = contributionBaseCents - cnssEmployee - amoEmployee - irMonthly;
  push('net', contributionBaseCents, undefined, netBeforeNonStatutory);

  const employerCostCents = cnssEmployer + amoEmployer;
  const totalEmployerCostCents = contributionBaseCents + employerCostCents;
  push('totalEmployerCost', contributionBaseCents, undefined, totalEmployerCostCents);

  return {
    cnssEmployeeCents: cnssEmployee,
    amoEmployeeCents: amoEmployee,
    irMonthlyCents: irMonthly,
    netBeforeNonStatutory,
    cnssEmployerCents: cnssEmployer,
    amoEmployerCents: amoEmployer,
    employerCostCents,
    irAnnualCents: irAnnual,
    bases: { cnssCappedBaseCents: cnssBase, annualGrossCents: annualGross, proAbatementCents: proAbatement, annualNetTaxableCents: annualNetTaxable },
    steps,
    ruleKey: formulaVersion,
  };
}

function computeIrAnnual(
  config: MoroccoV1RuleConfig,
  annualNetTaxable: Money,
  steps: StatutoryStep[],
  push: (step: string, baseCents: Money, rateBp: number | undefined, resultCents: Money) => void,
  formulaVersion: string,
): Money {
  for (const b of config.ir.brackets) {
    const isCatchAll = b.maxAnnualCents === Number.POSITIVE_INFINITY;
    const max = isCatchAll ? 0n : BigInt(b.maxAnnualCents);
    if (isCatchAll || annualNetTaxable <= max) {
      const grossTax = mulBpInt(annualNetTaxable, b.rateBp);
      const tax = grossTax - BigInt(b.deductionCents) < 0n ? 0n : grossTax - BigInt(b.deductionCents);
      steps.push({ step: `ir_bracket_${b.rateBp}`, baseCents: annualNetTaxable.toString(), rateBp: b.rateBp, resultCents: tax.toString(), formulaVersion });
      return tax;
    }
  }
  throw new FormulaError('Barème IR sans tranche applicable.');
}

/** Resolve which effective regulation version applies on a date (V1: single). */
export function resolveRegulationVersions(config: MoroccoV1RuleConfig, onDate: string): MoroccoV1RuleConfig {
  if (config.effectiveTo && onDate > config.effectiveTo) {
    throw new RegulationError(`Aucune version réglementaire effective pour la date ${onDate}.`);
  }
  if (onDate < config.effectiveFrom) {
    throw new RegulationError(`Aucune version réglementaire effective avant le ${config.effectiveFrom}.`);
  }
  return config;
}
