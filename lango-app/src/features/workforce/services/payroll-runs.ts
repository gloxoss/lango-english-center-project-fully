/**
 * Immutable payroll run lifecycle service.
 *
 * Owns the payroll period state machine:
 *
 *   draft → calculating → calculated → under_review → approved → posted →
 *   paid → closed
 *
 * with safe `failed`, `cancelled` and `reversed` paths.
 *
 * Invariants enforced here (the API routes additionally enforce the granular
 * capabilities): recalculation is only allowed **before approval**; the
 * complete calculation input set is frozen into `payroll_periods.frozen_inputs`
 * when a run enters `calculating`; approved/posted results and payslips are
 * immutable (re-calc is impossible and posting freezes run lines); maker/checker
 * separation requires the approver to differ from the calculator.
 *
 * Accounting integration (`postRun`/`reverseRun` calling
 * `postAccountingVoucher`) is wired in `payroll-posting.ts` and invoked here; a
 * posting never inserts journal rows directly.
 *
 * Every mutation runs inside a transaction that takes a per-run advisory xact
 * lock and performs an optimistic status-guarded UPDATE, so two actors cannot
 * drive the same run into contradictory states.
 */

import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  employeeProfiles,
  employeeSalaryAssignments,
  leaveCategories,
  leaveRequests,
  payrollPeriods,
  payrollRunLines,
  payslips,
} from '@/models/Schema';
import {
  employeeAwards,
  employeePayrollProfiles,
  payrollAdjustments,
  salaryAdvances,
  payrollCalculationTraces,
  payrollRegulationVersions,
  payrollResultLines,
  salaryAdvanceRepaymentSchedules,
  salaryComponentVersions,
  salaryStructureComponents,
  salaryStructureVersions,
} from '@/models/Schema';
import {
  AdjustmentLike,
  AwardLike,
  ComponentLike,
  computeProration,
  EngineInput,
  EngineResult,
  Proration,
  runPayrollEngine,
  serializeEngineResult,
  toCents,
} from './payroll-engine';
import {
  MoroccoV1RuleConfig,
  parseRegulationConfig,
  resolveRegulationVersions,
} from './ma-regulation-adapter';
import {
  PayrollPostingRef,
  postRunAccounting,
  reverseRunAccounting,
} from './payroll-posting';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type RunStatus =
  | 'draft' | 'calculating' | 'calculated' | 'under_review' | 'approved'
  | 'posted' | 'paid' | 'closed' | 'failed' | 'cancelled' | 'reversed';

export type FrozenEmployeeInput = {
  userId: string;
  employeeId: string;
  dependantsCount: number;
  paymentMethod: string | null;
  components: ComponentLike[];
  proration: Proration | null;
  adjustments: AdjustmentLike[];
  awards: AwardLike[];
  advanceRecoveries: Array<{ label: string; amountCents: bigint }>;
  minNetCents: bigint | null;
};

export type FrozenRunInputs = {
  regulationVersionId: string;
  regulation: MoroccoV1RuleConfig;
  onDate: string;
  periodStart: string;
  periodEnd: string;
  employees: FrozenEmployeeInput[];
};

export type RunActor = { tenantId: string; actorId: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─────────────────────────────────────────────────────────
// State machine (pure)
// ─────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  draft: ['calculating', 'cancelled', 'failed'],
  calculating: ['calculated', 'failed', 'cancelled'],
  calculated: ['calculating', 'under_review', 'approved', 'cancelled', 'failed'],
  under_review: ['approved', 'calculating', 'cancelled'],
  approved: ['posted', 'cancelled'],
  posted: ['paid', 'reversed'],
  paid: ['closed', 'reversed'],
  closed: [],
  failed: ['calculating', 'cancelled'],
  cancelled: [],
  reversed: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new ApiError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      `Transition de paie impossible: ${from} → ${to}.`,
    );
  }
}

// Statuses that still allow (re)calculation — i.e. **before approval**.
const RECALCULATABLE: ReadonlySet<RunStatus> = new Set([
  'draft', 'calculating', 'calculated', 'under_review', 'failed',
]);

export function isRecalculatable(status: RunStatus): boolean {
  return RECALCULATABLE.has(status);
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end) };
}

function overlapDays(rangeStart: string, rangeEnd: string, reqStart: string, reqEnd: string): number {
  const aStart = Date.parse(rangeStart);
  const aEnd = Date.parse(rangeEnd);
  const bStart = Date.parse(reqStart);
  const bEnd = Date.parse(reqEnd);
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  if (e < s) return 0;
  return Math.round((e - s) / DAY_MS) + 1;
}

async function loadRun(tx: Tx, tenantId: string, runId: string) {
  const [run] = await tx.select().from(payrollPeriods).where(and(
    eq(payrollPeriods.tenantId, tenantId),
    eq(payrollPeriods.id, runId),
  ));
  if (!run) throw new ApiError(404, 'PAYROLL_RUN_NOT_FOUND', 'Période de paie introuvable.');
  return run;
}

function lockRun(tx: Tx, tenantId: string, runId: string) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`payroll:run:${tenantId}:${runId}`}, 0))`);
}

async function resolveRegulation(
  tx: Tx,
  tenantId: string,
  regulationVersionId: string | null,
  onDate: string,
): Promise<{ versionId: string; cfg: MoroccoV1RuleConfig }> {
  let version;
  if (regulationVersionId) {
    [version] = await tx.select().from(payrollRegulationVersions).where(and(
      eq(payrollRegulationVersions.tenantId, tenantId),
      eq(payrollRegulationVersions.id, regulationVersionId),
      eq(payrollRegulationVersions.status, 'published'),
    ));
    if (!version) throw new ApiError(422, 'PAYROLL_REGULATION_MISSING', 'Version réglementaire introuvable ou non publiée.');
  } else {
    const candidates = await tx.select().from(payrollRegulationVersions).where(and(
      eq(payrollRegulationVersions.tenantId, tenantId),
      eq(payrollRegulationVersions.status, 'published'),
      lte(payrollRegulationVersions.effectiveFrom, onDate),
    )).orderBy(desc(payrollRegulationVersions.effectiveFrom));
    version = candidates.find(v => !v.effectiveTo || v.effectiveTo >= onDate);
    if (!version) throw new ApiError(422, 'PAYROLL_REGULATION_MISSING', `Aucune version réglementaire publiée effective le ${onDate}.`);
  }
  const cfg = parseRegulationConfig(version.ruleConfig);
  resolveRegulationVersions(cfg, onDate);
  return { versionId: version.id, cfg };
}

function toComponentLike(v: typeof salaryComponentVersions.$inferSelect): ComponentLike {
  return {
    code: v.code,
    label: v.name,
    componentType: v.componentType as ComponentLike['componentType'],
    valueType: v.valueType as ComponentLike['valueType'],
    fixedValue: v.fixedValue ?? undefined,
    percentOf: v.percentOf ?? undefined,
    percentBp: v.percentBp ?? undefined,
    formula: v.formula ?? undefined,
    taxable: v.taxable,
    contributable: v.contributable,
    side: (v.side === 'both' ? 'both' : v.side) as ComponentLike['side'],
    proratable: v.proratable,
    recurring: v.recurring,
    roundingMode: v.roundingMode as ComponentLike['roundingMode'],
    sortOrder: v.sortOrder,
    formulaVersion: `${v.versionNo}`,
  };
}

// ─────────────────────────────────────────────────────────
// Input collection (from the tenant's HR/advance/leave/award data)
// ─────────────────────────────────────────────────────────

async function collectEmployeeInputs(
  tx: Tx,
  tenantId: string,
  run: typeof payrollPeriods.$inferSelect,
  onDate: string,
  periodStart: string,
  periodEnd: string,
  minNetCents: bigint | null,
): Promise<FrozenEmployeeInput[]> {
  const profiles = await tx.select().from(employeeProfiles)
    .leftJoin(employeePayrollProfiles, and(
      eq(employeePayrollProfiles.tenantId, tenantId),
      eq(employeePayrollProfiles.employeeId, employeeProfiles.id),
    ))
    .where(and(
      eq(employeeProfiles.tenantId, tenantId),
      inArray(employeeProfiles.employmentStatus, ['active', 'probation', 'on_leave']),
    ))
    .orderBy(employeeProfiles.firstName, employeeProfiles.lastName);

  const employeeIds = profiles.map(p => p.employee_profiles.id);
  const userIds = profiles.filter(p => p.employee_profiles.userId).map(p => p.employee_profiles.userId as string);
  if (profiles.length === 0) return [];

  // Latest active salary assignment per employee.
  const assignments = await tx.select().from(employeeSalaryAssignments)
    .where(and(
      eq(employeeSalaryAssignments.tenantId, tenantId),
      inArray(employeeSalaryAssignments.userId, userIds),
      lte(employeeSalaryAssignments.effectiveDate, onDate),
    ))
    .orderBy(desc(employeeSalaryAssignments.effectiveDate));
  const assignmentByUser = new Map<string, typeof employeeSalaryAssignments.$inferSelect>();
  for (const a of assignments) {
    if (!assignmentByUser.has(a.userId)) assignmentByUser.set(a.userId, a);
  }

  // Effective published structure per template.
  const templateIds = Array.from(new Set(assignments.map(a => a.templateId)));
  const structures: Array<typeof salaryStructureVersions.$inferSelect> = [];
  for (const templateId of templateIds) {
    const candidates = await tx.select().from(salaryStructureVersions).where(and(
      eq(salaryStructureVersions.tenantId, tenantId),
      eq(salaryStructureVersions.templateId, templateId),
      eq(salaryStructureVersions.status, 'published'),
      lte(salaryStructureVersions.effectiveFrom, onDate),
    )).orderBy(desc(salaryStructureVersions.effectiveFrom));
    const s = candidates.find(v => !v.effectiveTo || v.effectiveTo >= onDate);
    if (s) structures.push(s);
  }
  const structureByTemplate = new Map(structures.map(s => [s.templateId, s]));

  // Structure → component versions.
  const componentVersionRows = new Map<string, typeof salaryComponentVersions.$inferSelect>();
  const componentsByStructure = new Map<string, Array<typeof salaryStructureComponents.$inferSelect>>();
  for (const s of structures) {
    const rows = await tx.select().from(salaryStructureComponents).where(and(
      eq(salaryStructureComponents.tenantId, tenantId),
      eq(salaryStructureComponents.structureVersionId, s.id),
    )).orderBy(salaryStructureComponents.sortOrder);
    componentsByStructure.set(s.id, rows);
    const cvIds = rows.map(r => r.componentVersionId);
    if (cvIds.length) {
      const cvs = await tx.select().from(salaryComponentVersions).where(inArray(salaryComponentVersions.id, cvIds));
      for (const cv of cvs) componentVersionRows.set(cv.id, cv);
    }
  }

  // Approved adjustments for the period.
  const adjustments = await tx.select().from(payrollAdjustments).where(and(
    eq(payrollAdjustments.tenantId, tenantId),
    inArray(payrollAdjustments.employeeId, employeeIds),
    eq(payrollAdjustments.status, 'approved'),
    or(
      eq(payrollAdjustments.periodId, run.id),
      and(
        eq(payrollAdjustments.effectivePeriodYear, run.year),
        eq(payrollAdjustments.effectivePeriodMonth, run.month),
      ),
    ),
  ));

  // Granted monetary awards dated inside the period.
  const awards = await tx.select().from(employeeAwards).where(and(
    eq(employeeAwards.tenantId, tenantId),
    inArray(employeeAwards.employeeId, employeeIds),
    eq(employeeAwards.status, 'granted'),
    gte(employeeAwards.awardDate, periodStart),
    lte(employeeAwards.awardDate, periodEnd),
  ));

  // Advance repayment installments due in this period and not yet recovered.
  const repayments = await tx.select().from(salaryAdvanceRepaymentSchedules).where(and(
    eq(salaryAdvanceRepaymentSchedules.tenantId, tenantId),
    eq(salaryAdvanceRepaymentSchedules.duePeriodYear, run.year),
    eq(salaryAdvanceRepaymentSchedules.duePeriodMonth, run.month),
    inArray(salaryAdvanceRepaymentSchedules.status, ['scheduled', 'recovering']),
    isNull(salaryAdvanceRepaymentSchedules.payrollRunLineId),
  ));
  // Route installments to their employee via the advance they belong to.
  const advanceIds = Array.from(new Set(repayments.map(r => r.advanceId)));
  const advances = advanceIds.length
    ? await tx.select({ id: salaryAdvances.id, employeeId: salaryAdvances.employeeId }).from(salaryAdvances).where(and(
      eq(salaryAdvances.tenantId, tenantId),
      inArray(salaryAdvances.id, advanceIds),
    ))
    : [];
  const employeeIdByAdvance = new Map(advances.map(a => [a.id, a.employeeId]));
  const recoveriesByEmployee = new Map<string, Array<{ label: string; amountCents: bigint }>>();
  for (const r of repayments) {
    const employeeId = employeeIdByAdvance.get(r.advanceId);
    if (!employeeId) continue;
    const list = recoveriesByEmployee.get(employeeId) ?? [];
    list.push({ label: `Avance (tranche ${r.installmentNo})`, amountCents: moneyToCents(r.amount) });
    recoveriesByEmployee.set(employeeId, list);
  }

  // Approved unpaid leave overlapping the period → unpaid days per user.
  const categories = await tx.select().from(leaveCategories).where(eq(leaveCategories.tenantId, tenantId));
  const unpaidCategoryIds = categories.filter(c => !c.isPaid).map(c => c.id);
  const unpaidByUser = new Map<string, number>();
  if (unpaidCategoryIds.length && userIds.length) {
    const leaves = await tx.select().from(leaveRequests).where(and(
      eq(leaveRequests.tenantId, tenantId),
      inArray(leaveRequests.userId, userIds),
      eq(leaveRequests.status, 'approved'),
      inArray(leaveRequests.categoryId, unpaidCategoryIds),
      lte(leaveRequests.startDate, periodEnd),
      gte(leaveRequests.endDate, periodStart),
    ));
    for (const lv of leaves) {
      const days = overlapDays(periodStart, periodEnd, lv.startDate, lv.endDate);
      unpaidByUser.set(lv.userId, (unpaidByUser.get(lv.userId) ?? 0) + days);
    }
  }

  const employees: FrozenEmployeeInput[] = [];
  for (const p of profiles) {
    const prof = p.employee_profiles;
    const payroll = p.employee_payroll_profiles ?? null;
    if (!prof.userId) continue; // only employees with a linked account get paid

    const assignment = assignmentByUser.get(prof.userId);
    let components: ComponentLike[] = [];
    if (assignment) {
      const structure = structureByTemplate.get(assignment.templateId);
      if (structure) {
        const rows = componentsByStructure.get(structure.id) ?? [];
        components = rows
          .map(r => {
            const cv = componentVersionRows.get(r.componentVersionId);
            if (!cv || cv.status !== 'published') return null;
            const c = toComponentLike(cv);
            if (r.baseValue !== null && r.baseValue !== undefined) c.fixedValue = r.baseValue;
            return c;
          })
          .filter((c): c is ComponentLike => c !== null)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      }
    }
    if (components.length === 0) {
      // Fallback: single fixed base component from the assignment / profile salary.
      const base = toCents(assignment?.baseSalary ?? prof.salary ?? '0');
      components = [{
        code: 'BASE',
        label: 'Salaire de base',
        componentType: 'earning',
        valueType: 'fixed',
        fixedValue: centsToMoney(base),
        taxable: true,
        contributable: true,
        side: 'employee',
        proratable: true,
        recurring: true,
      }];
    }

    const joinDate = prof.hireDate ?? prof.contractStartDate ?? null;
    const endDate = prof.contractEndDate ?? null;
    const unpaidLeaveDays = unpaidByUser.get(prof.userId) ?? 0;
    const proration = computeProration(periodStart, periodEnd, {
      joinDate,
      endDate,
      unpaidLeaveDays: unpaidLeaveDays > 0 ? unpaidLeaveDays : undefined,
    });

    const employeeAdjustments: AdjustmentLike[] = adjustments
      .filter(a => a.employeeId === prof.id && a.amount !== null)
      .map(a => ({
        code: a.componentId ?? undefined,
        label: a.reason ?? 'Ajustement',
        amount: a.amount as string,
        adjustmentType: a.taxTreatment === 'non_taxable' && a.adjustmentType === 'deduction' ? 'deduction' : (a.adjustmentType as 'earning' | 'deduction'),
      }));

    const employeeAwards: AwardLike[] = awards
      .filter(a => a.employeeId === prof.id)
      .map(a => ({ label: a.title, amount: toCents(a.monetaryReward), taxable: true, contributable: true }));

    employees.push({
      userId: prof.userId,
      employeeId: prof.id,
      dependantsCount: payroll?.dependantsCount ?? prof.dependantsCount ?? 0,
      paymentMethod: payroll?.paymentMethod ?? null,
      components,
      proration,
      adjustments: employeeAdjustments,
      awards: employeeAwards,
      advanceRecoveries: recoveriesByEmployee.get(prof.id) ?? [],
      minNetCents,
    });
  }

  return employees;
}

// ─────────────────────────────────────────────────────────
// Public lifecycle operations
// ─────────────────────────────────────────────────────────

export async function createRun(tenantId: string, year: number, month: number) {
  const [existing] = await db.select({ id: payrollPeriods.id }).from(payrollPeriods).where(and(
    eq(payrollPeriods.tenantId, tenantId),
    eq(payrollPeriods.year, year),
    eq(payrollPeriods.month, month),
  )).limit(1);
  if (existing) {
    throw new ApiError(409, 'PAYROLL_PERIOD_EXISTS', `Une période de paie ${year}-${month} existe déjà.`);
  }
  const [run] = await db.insert(payrollPeriods).values({
    tenantId,
    year,
    month,
    status: 'draft',
  }).returning();
  if (!run) throw new ApiError(500, 'PAYROLL_CREATE_FAILED', 'Impossible de créer la période de paie.');
  return run;
}

/**
 * Enter `calculating`: freezes the complete input set (employees, structures,
 * adjustments, awards, advance recoveries, leave, regulation) into
 * `frozen_inputs` and bumps the calculation version. Prior transient results
 * are cleared so a re-calc never leaves stale lines.
 */
export async function beginCalculation(runId: string, actor: RunActor, regulationVersionId?: string | null) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'calculating');

    const { start, end } = monthBounds(run.year, run.month);
    const onDate = start;
    const { versionId, cfg } = await resolveRegulation(tx, tenantId, regulationVersionId ?? null, onDate);
    const minNet = cfg.netProtection.minMonthlyCents === null ? null : BigInt(cfg.netProtection.minMonthlyCents);
    const employees = await collectEmployeeInputs(tx, tenantId, run, onDate, start, end, minNet);

    const frozen: FrozenRunInputs = {
      regulationVersionId: versionId,
      regulation: cfg,
      onDate,
      periodStart: start,
      periodEnd: end,
      employees,
    };

    const nextVersion = (run.version ?? 1) + 1;
    await tx.delete(payrollResultLines).where(eq(payrollResultLines.runId, runId));
    await tx.delete(payrollCalculationTraces).where(eq(payrollCalculationTraces.runId, runId));

    const [updated] = await tx.update(payrollPeriods)
      .set({
        status: 'calculating',
        regulationVersionId: versionId,
        version: nextVersion,
        frozenInputs: frozen,
        calculatedById: null,
        calculatedAt: null,
        approverId: null,
        approvedAt: null,
        posterId: null,
        postedAt: null,
      })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, run.status)))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant le calcul.');
    return updated;
  });
}

/**
 * Finish a `calculating` run: recompute every frozen employee through the engine
 * and write immutable run lines, componentized result lines and deterministic
 * traces. Transitions to `calculated`.
 */
export async function completeCalculation(runId: string, actor: RunActor) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'calculated');
    if (!run.frozenInputs || !run.regulationVersionId) {
      throw new ApiError(409, 'PAYROLL_NOT_FROZEN', 'La période de paie n\'a pas d\'entrées figées.');
    }
    const frozen = run.frozenInputs as unknown as FrozenRunInputs;
    const cfg = parseRegulationConfig(frozen.regulation);

    const insertedLines = [];
    for (const input of frozen.employees) {
      const engineInput: EngineInput = {
        regulation: cfg,
        components: input.components,
        adjustments: input.adjustments,
        awards: input.awards,
        advanceRecoveries: input.advanceRecoveries,
        proration: input.proration,
        dependantsCount: input.dependantsCount,
        minNetCents: input.minNetCents,
        onDate: frozen.onDate,
      };
      const result = runPayrollEngine(engineInput);

      const prorationFactor = input.proration && input.proration.totalDays > 0
        ? (input.proration.earnedDays / input.proration.totalDays).toFixed(4)
        : '1.0000';

      const [line] = await tx.insert(payrollRunLines).values({
        tenantId,
        periodId: runId,
        userId: input.userId,
        grossSalary: centsToMoney(result.grossCents),
        cnssEmployee: centsToMoney(result.lines.find(l => l.code === 'CNSS_EMP')?.amountCents ?? 0n),
        amoEmployee: centsToMoney(result.lines.find(l => l.code === 'AMO_EMP')?.amountCents ?? 0n),
        irTax: centsToMoney(result.lines.find(l => l.code === 'IR')?.amountCents ?? 0n),
        netSalary: centsToMoney(result.netCents),
        cnssEmployer: centsToMoney(result.lines.find(l => l.code === 'CNSS_EMPLOYER')?.amountCents ?? 0n),
        amoEmployer: centsToMoney(result.lines.find(l => l.code === 'AMO_EMPLOYER')?.amountCents ?? 0n),
        totalEmployerCost: centsToMoney(result.totalEmployerCostCents),
        calculationSnapshot: serializeEngineResult(result),
        regulationVersionId: frozen.regulationVersionId,
        calculationVersion: run.version ?? 1,
        prorationFactor,
        netPayable: centsToMoney(result.netPayableCents),
        paymentMethod: input.paymentMethod ?? null,
        isFrozen: false,
        isReversed: false,
      }).returning();

      for (const l of result.lines) {
        await tx.insert(payrollResultLines).values({
          tenantId,
          runId,
          userId: input.userId,
          lineCode: l.code,
          label: l.label,
          lineType: l.lineType,
          amount: centsToMoney(l.amountCents),
          base: l.baseCents === null ? null : centsToMoney(l.baseCents),
          rate: l.rateBp === null ? null : centsToMoney(BigInt(l.rateBp)),
          formulaVersion: l.formulaVersion ?? null,
        });
      }

      await tx.insert(payrollCalculationTraces).values({
        tenantId,
        runId,
        userId: input.userId,
        version: run.version ?? 1,
        regulationVersionId: frozen.regulationVersionId,
        trace: result.trace,
        inputSnapshot: input,
      });

      insertedLines.push(line);
    }

    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'calculated', calculatedById: actorId, calculatedAt: new Date().toISOString() })
      .where(and(
        eq(payrollPeriods.id, runId),
        eq(payrollPeriods.tenantId, tenantId),
        eq(payrollPeriods.status, 'calculating'),
      ))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant le calcul.');
    return { run: updated, lines: insertedLines };
  });
}

/** Atomic convenience: begin + complete in one transaction. */
export async function calculateRun(runId: string, actor: RunActor, regulationVersionId?: string | null) {
  await beginCalculation(runId, actor, regulationVersionId);
  return completeCalculation(runId, actor);
}

export async function submitForReview(runId: string, actor: RunActor) {
  const { tenantId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'under_review');
    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'under_review' })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, run.status)))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant la revue.');
    return updated;
  });
}

/**
 * Approve a run. Maker/checker: the approver must not be the calculator and the
 * run must already be `calculated` (or under review). Once approved, results are
 * immutable — no path back to calculation exists.
 */
export async function approveRun(runId: string, actor: RunActor) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    if (run.status !== 'calculated' && run.status !== 'under_review') {
      assertTransition(run.status as RunStatus,'approved');
    }
    if (run.calculatedById && run.calculatedById === actorId) {
      throw new ApiError(403, 'PAYROLL_SELF_APPROVAL', 'Le calculateur ne peut pas approuver sa propre paie (séparation des tâches).');
    }
    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'approved', approverId: actorId, approvedAt: new Date().toISOString() })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, run.status)))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant l\'approbation.');
    return updated;
  });
}

/**
 * Post an approved run: posts the balanced accrual through Accounting's
 * `postAccountingVoucher`, then freezes every run line and issues one immutable
 * payslip per line. If the accounting contract is not fully published (missing
 * account mapping / journal / voucher type / fiscal period), posting is blocked
 * and the run stays `approved` — final posting only happens once the contract
 * is published. This service never inserts journal rows itself.
 */
export async function postRun(runId: string, actor: RunActor, posting: PayrollPostingRef) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'posted');

    const lines = await tx.select().from(payrollRunLines).where(and(
      eq(payrollRunLines.tenantId, tenantId),
      eq(payrollRunLines.periodId, runId),
    ));
    if (lines.length === 0) {
      throw new ApiError(409, 'PAYROLL_NO_LINES', 'Impossible de publier une paie sans lignes calculées.');
    }

    const accounting = await postRunAccounting({
      principal: { tenantId, actorId },
      runId,
      sourceVersion: run.version ?? 1,
      entryDate: `${run.year}-${String(run.month).padStart(2, '0')}-01`,
      ref: posting,
      rows: lines.map(l => ({
        grossSalary: l.grossSalary,
        cnssEmployee: l.cnssEmployee,
        amoEmployee: l.amoEmployee,
        irTax: l.irTax,
        cnssEmployer: l.cnssEmployer,
        amoEmployer: l.amoEmployer,
        netPayable: l.netPayable ?? '0',
      })),
    });
    if (accounting.blocked) {
      throw new ApiError(409, accounting.reason, 'Comptabilisation paie bloquée : le contrat comptable n’est pas entièrement publié.');
    }

    await tx.update(payrollRunLines)
      .set({ isFrozen: true })
      .where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, runId)));

    const existingPayslips = await tx.select({ runLineId: payslips.runLineId }).from(payslips).where(and(
      eq(payslips.tenantId, tenantId),
      eq(payslips.periodId, runId),
    ));
    const existingIds = new Set(existingPayslips.map(p => p.runLineId));
    let seq = 0;
    for (const line of lines) {
      if (existingIds.has(line.id)) continue;
      seq += 1;
      await tx.insert(payslips).values({
        tenantId,
        periodId: runId,
        runLineId: line.id,
        userId: line.userId,
        payslipNumber: `PAYE-${run.year}${String(run.month).padStart(2, '0')}-${String(seq).padStart(3, '0')}`,
        status: 'issued',
        regulationVersionId: run.regulationVersionId,
      });
    }

    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'posted', posterId: actorId, postedAt: new Date().toISOString() })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, 'approved')))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant la publication.');
    return updated;
  });
}

export async function markPaid(runId: string, actor: RunActor, paymentBatchId?: string | null) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'paid');
    const [updated] = await tx.update(payrollPeriods)
      .set({
        status: 'paid',
        paymentBatchId: paymentBatchId ?? run.paymentBatchId,
        closedAt: null,
      })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, 'posted')))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant le paiement.');
    return updated;
  });
}

export async function closeRun(runId: string, actor: RunActor) {
  const { tenantId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'closed');
    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, 'paid')))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant la clôture.');
    return updated;
  });
}

/** Cancel a run that has not been approved/posted. Safe for failed runs. */
export async function cancelRun(runId: string, actor: RunActor, reason?: string | null) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'cancelled');
    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'cancelled', cancelledById: actorId, cancelledAt: new Date().toISOString(), cancellationReason: reason ?? null })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, run.status)))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant l\'annulation.');
    return updated;
  });
}

/**
 * Reverse a posted/paid run: counters the recorded accrual through
 * `reverseAccountingVoucher`, transitions to `reversed` and flags its lines.
 */
export async function reverseRun(runId: string, actor: RunActor, posting: PayrollPostingRef) {
  const { tenantId, actorId } = actor;
  return db.transaction(async (tx) => {
    await lockRun(tx, tenantId, runId);
    const run = await loadRun(tx, tenantId, runId);
    assertTransition(run.status as RunStatus,'reversed');

    const accounting = await reverseRunAccounting({
      principal: { tenantId, actorId },
      runId,
      sourceVersion: run.version ?? 1,
      entryDate: `${run.year}-${String(run.month).padStart(2, '0')}-01`,
      ref: posting,
    });
    if (accounting.blocked) {
      throw new ApiError(409, accounting.reason, 'Contrepassation paie bloquée : aucun cumul comptabilisé.');
    }

    await tx.update(payrollRunLines)
      .set({ isReversed: true })
      .where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, runId)));
    const [updated] = await tx.update(payrollPeriods)
      .set({ status: 'reversed' })
      .where(and(eq(payrollPeriods.id, runId), eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.status, run.status)))
      .returning();
    if (!updated) throw new ApiError(409, 'PAYROLL_INVALID_TRANSITION', 'La période a été modifiée pendant l\'inversion.');
    return updated;
  });
}

export type { Proration };
