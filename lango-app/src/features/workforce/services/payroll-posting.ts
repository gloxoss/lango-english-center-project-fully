/**
 * Payroll → Accounting posting handoff (WA6 contract).
 *
 * Payroll owns the operational run (`payroll_periods` + `payroll_run_lines`);
 * Accounting owns the journal entry. This adapter:
 *
 *  1. Builds a *balanced* accrual voucher from posted run lines:
 *       Debit  charges salariales (gross + employer costs)
 *       Credit CNSS, AMO, IR, salaire net à payer, retenues/avances
 *  2. Resolves each account through `accounting_source_mappings` scoped to the
 *     `payroll` source module (module default when `source_key` is NULL).
 *  3. Posts via Accounting's published `postAccountingVoucher` — never a direct
 *     journal insert, payload-bound idempotency by
 *     (sourceModule, sourceDocumentId, sourceVersion), fiscal-period enforced
 *     by the contract.
 *  4. If a mapping is missing, the run is NOT posted: an `accounting_adapter_exception`
 *     is queued (blocked) for the accounting UI to resolve — final posting stays
 *     blocked until the contract is published.
 *  5. Reversals reuse `reverseAccountingVoucher` against the recorded accrual.
 *
 * Every voucher is recorded in `payroll_postings` (type accrual | reversal) so
 * the run keeps an auditable link to its journal entries.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  accountingAdapterExceptions,
  accountingSourceMappings,
  payrollPostings,
} from '@/models/Schema';
import {
  accountingPayloadDigest,
  postAccountingVoucher,
  reverseAccountingVoucher,
  type AccountingPostingLine,
  type AccountingPostingResult,
} from '@/features/accounting/services/posting-service';

export const PAYROLL_MODULE = 'payroll';

export type PayrollPostingPrincipal = { tenantId: string; actorId: string };
export type PayrollPostingRef = { journalCode: string; voucherTypeCode: string };

export const PAYROLL_ACCOUNT_KEYS = [
  'salary_expense',
  'cnss_payable',
  'amo_payable',
  'ir_payable',
  'net_payable',
  'advance_recovery',
] as const;
export type PayrollAccountKey = (typeof PAYROLL_ACCOUNT_KEYS)[number];

export type PayrollRunLineAmounts = {
  grossSalary: string;
  cnssEmployee: string;
  amoEmployee: string;
  irTax: string;
  cnssEmployer: string;
  amoEmployer: string;
  netPayable: string;
};

export type PayrollKeyedLine = {
  accountKey: PayrollAccountKey;
  debitAmount: string;
  creditAmount: string;
  memo: string;
};

export type PayrollAccrual = {
  lines: PayrollKeyedLine[];
  totals: {
    grossCents: bigint;
    employerCostCents: bigint;
    statutoryCents: bigint;
    netPayableCents: bigint;
    nonStatutoryCents: bigint;
  };
};

/**
 * Pure accrual builder. Balanced by construction:
 *   debits  = gross + employer costs
 *   credits = (CNSS e+p) + (AMO e+p) + IR + net payable + non-statutory
 * where nonStatutory = gross − statutoryEmployee − netPayable (the engine's
 * identity: netPayable = gross − statutoryEmployee − nonStatutory).
 */
export function buildPayrollAccrual(rows: PayrollRunLineAmounts[]): PayrollAccrual {
  let grossCents = 0n;
  let employerCostCents = 0n;
  let cnssCents = 0n;
  let amoCents = 0n;
  let irCents = 0n;
  let netPayableCents = 0n;
  let nonStatutoryCents = 0n;

  for (const r of rows) {
    const gross = moneyToCents(r.grossSalary);
    const cnssEmployee = moneyToCents(r.cnssEmployee);
    const amoEmployee = moneyToCents(r.amoEmployee);
    const ir = moneyToCents(r.irTax);
    const cnssEmployer = moneyToCents(r.cnssEmployer);
    const amoEmployer = moneyToCents(r.amoEmployer);
    const net = moneyToCents(r.netPayable);
    const statutoryEmployee = cnssEmployee + amoEmployee + ir;

    grossCents += gross;
    employerCostCents += cnssEmployer + amoEmployer;
    cnssCents += cnssEmployee + cnssEmployer;
    amoCents += amoEmployee + amoEmployer;
    irCents += ir;
    netPayableCents += net;
    nonStatutoryCents += gross - statutoryEmployee - net;
  }

  const lines: PayrollKeyedLine[] = [];
  const add = (accountKey: PayrollAccountKey, debit: bigint, credit: bigint, memo: string): void => {
    if (debit === 0n && credit === 0n) return;
    lines.push({ accountKey, debitAmount: centsToMoney(debit), creditAmount: centsToMoney(credit), memo });
  };
  add('salary_expense', grossCents + employerCostCents, 0n, 'Charges salariales (brut + charges patronales)');
  add('cnss_payable', 0n, cnssCents, 'CNSS part salariale et patronale');
  add('amo_payable', 0n, amoCents, 'AMO part salariale et patronale');
  add('ir_payable', 0n, irCents, 'IR retenu à la source');
  add('net_payable', 0n, netPayableCents, 'Salaire net à payer');
  add('advance_recovery', 0n, nonStatutoryCents, 'Retenues non salariales / recouvrement d’avances');

  return {
    lines,
    totals: {
      grossCents,
      employerCostCents,
      statutoryCents: cnssCents + amoCents + irCents,
      netPayableCents,
      nonStatutoryCents,
    },
  };
}

async function resolvePayrollAccount(tenantId: string, keyType: string): Promise<string | null> {
  const rows = await db.select({ accountId: accountingSourceMappings.accountId })
    .from(accountingSourceMappings)
    .where(and(
      eq(accountingSourceMappings.tenantId, tenantId),
      eq(accountingSourceMappings.sourceModule, PAYROLL_MODULE),
      eq(accountingSourceMappings.sourceKeyType, keyType),
      isNull(accountingSourceMappings.sourceKey),
    ))
    .limit(1);
  return rows[0]?.accountId ?? null;
}

async function insertPayrollException(principal: PayrollPostingPrincipal, input: {
  runId: string; version: number; reason: string; detail: string; payload: Record<string, unknown>;
}) {
  const [row] = await db.insert(accountingAdapterExceptions).values({
    tenantId: principal.tenantId,
    sourceModule: PAYROLL_MODULE,
    sourceDocumentType: 'payroll_period',
    sourceDocumentId: input.runId,
    version: input.version,
    reason: input.reason,
    detail: input.detail,
    payload: input.payload,
    status: 'open',
    createdBy: principal.actorId,
  }).onConflictDoNothing().returning();
  return row;
}

export type PostRunAccountingInput = {
  principal: PayrollPostingPrincipal;
  runId: string;
  sourceVersion: number;
  entryDate: string;
  ref: PayrollPostingRef;
  rows: PayrollRunLineAmounts[];
};

export type PayrollPostingResult =
  | { blocked: true; reason: string; exceptionId: string | null }
  | { blocked: false; posting: AccountingPostingResult; record: typeof payrollPostings.$inferSelect };

async function recordPosting(principal: PayrollPostingPrincipal, runId: string, input: {
  sourceVersion: number; postingType: 'accrual' | 'reversal'; journalEntryId: string;
  postingRequestId: string | null; idempotencyKey: string; payloadDigest: string;
}): Promise<typeof payrollPostings.$inferSelect> {
  const [existing] = await db.select().from(payrollPostings).where(and(
    eq(payrollPostings.tenantId, principal.tenantId),
    eq(payrollPostings.runId, runId),
    eq(payrollPostings.postingType, input.postingType),
    eq(payrollPostings.idempotencyKey, input.idempotencyKey),
  )).limit(1);
  if (existing) return existing;
  const [record] = await db.insert(payrollPostings).values({
    tenantId: principal.tenantId,
    runId,
    journalEntryId: input.journalEntryId,
    postingRequestId: input.postingRequestId,
    payloadDigest: input.payloadDigest,
    sourceVersion: input.sourceVersion,
    postingType: input.postingType,
    status: 'succeeded',
    idempotencyKey: input.idempotencyKey,
    postedById: principal.actorId,
    postedAt: new Date().toISOString(),
  }).returning();
  if (!record) throw new ApiError(500, 'PAYROLL_POSTING_RECORD_FAILED', 'Impossible d’enregistrer la comptabilisation.');
  return record;
}

/**
 * Post the payroll accrual for a run. Returns `blocked` (with a queued
 * accounting exception) when the accounting contract is not fully published —
 * missing account mapping, journal/voucher type, or fiscal period are surfaced
 * by `postAccountingVoucher` and never leave a half-posted run.
 */
export async function postRunAccounting(input: PostRunAccountingInput): Promise<PayrollPostingResult> {
  const { principal, runId, sourceVersion, entryDate, ref } = input;
  const accrual = buildPayrollAccrual(input.rows);

  const neededKeys = [...new Set(accrual.lines.map(l => l.accountKey))];
  const resolved = new Map<PayrollAccountKey, string>();
  const missingKeys: PayrollAccountKey[] = [];
  for (const key of neededKeys) {
    const accountId = await resolvePayrollAccount(principal.tenantId, key);
    if (accountId) resolved.set(key, accountId);
    else missingKeys.push(key);
  }
  if (missingKeys.length > 0) {
    const reason = 'PAYROLL_ACCOUNT_MAPPING_MISSING';
    const exception = await insertPayrollException(principal, {
      runId,
      version: sourceVersion,
      reason,
      detail: `Comptabilisation paie bloquée — mapping comptable manquant: ${missingKeys.join(', ')}.`,
      payload: { runId, missingKeys, totalDebitCents: String(accrual.totals.grossCents + accrual.totals.employerCostCents) },
    });
    return { blocked: true, reason, exceptionId: exception?.id ?? null };
  }

  const lines: AccountingPostingLine[] = accrual.lines.map(l => ({
    accountId: resolved.get(l.accountKey) as string,
    debitAmount: l.debitAmount,
    creditAmount: l.creditAmount,
    memo: l.memo,
  }));

  const inputPayload = {
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    entryDate,
    description: `Paie — cumul ${runId} (v${sourceVersion})`,
    sourceModule: PAYROLL_MODULE,
    sourceDocumentId: runId,
    sourceVersion,
    idempotencyKey: `${PAYROLL_MODULE}:${principal.tenantId}:${runId}:accrual:v${sourceVersion}`,
    journalCode: ref.journalCode,
    voucherTypeCode: ref.voucherTypeCode,
    lines,
  };
  const posting = await postAccountingVoucher(inputPayload);
  const record = await recordPosting(principal, runId, {
    sourceVersion,
    postingType: 'accrual',
    journalEntryId: posting.entry.id,
    postingRequestId: posting.postingRequestId,
    idempotencyKey: inputPayload.idempotencyKey,
    payloadDigest: accountingPayloadDigest(inputPayload),
  });
  return { blocked: false, posting, record };
}

export type ReverseRunAccountingInput = {
  principal: PayrollPostingPrincipal;
  runId: string;
  sourceVersion: number;
  entryDate: string;
  ref: PayrollPostingRef;
};

export async function reverseRunAccounting(input: ReverseRunAccountingInput): Promise<PayrollPostingResult> {
  const { principal, runId, sourceVersion, entryDate, ref } = input;
  const [accrualRecord] = await db.select().from(payrollPostings).where(and(
    eq(payrollPostings.tenantId, principal.tenantId),
    eq(payrollPostings.runId, runId),
    eq(payrollPostings.postingType, 'accrual'),
    eq(payrollPostings.status, 'succeeded'),
  )).orderBy(desc(payrollPostings.createdAt)).limit(1);
  if (!accrualRecord?.journalEntryId) {
    const reason = 'PAYROLL_POSTING_RECORD_MISSING';
    await insertPayrollException(principal, {
      runId,
      version: sourceVersion,
      reason,
      detail: 'Contrepassation impossible : aucun cumul comptabilisé pour cette paie.',
      payload: { runId },
    });
    return { blocked: true, reason, exceptionId: null };
  }

  // The reversal is a distinct posting event: it gets its own source identity so
  // postAccountingVoucher's (sourceModule, sourceDocumentId, sourceVersion)
  // idempotency branch does not collide with the accrual at v{sourceVersion}.
  // The idempotencyKey stays bound to the accrual version so a retry is a no-op.
  const idempotencyKey = `${PAYROLL_MODULE}:${principal.tenantId}:${runId}:reversal:v${sourceVersion}`;
  const reversalSourceVersion = sourceVersion + 1;
  const posting = await reverseAccountingVoucher({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    entryDate,
    description: `Contrepassation paie ${runId} (v${sourceVersion})`,
    sourceModule: PAYROLL_MODULE,
    sourceDocumentId: runId,
    sourceVersion: reversalSourceVersion,
    idempotencyKey,
    journalCode: ref.journalCode,
    voucherTypeCode: ref.voucherTypeCode,
    originalEntryId: accrualRecord.journalEntryId,
  });
  const record = await recordPosting(principal, runId, {
    sourceVersion: reversalSourceVersion,
    postingType: 'reversal',
    journalEntryId: posting.entry.id,
    postingRequestId: posting.postingRequestId,
    idempotencyKey,
    payloadDigest: accountingPayloadDigest({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      entryDate,
      description: `Contrepassation paie ${runId} (v${sourceVersion})`,
      sourceModule: PAYROLL_MODULE,
      sourceDocumentId: runId,
      sourceVersion: reversalSourceVersion,
      idempotencyKey,
      journalCode: ref.journalCode,
      voucherTypeCode: ref.voucherTypeCode,
      reversalOfEntryId: accrualRecord.journalEntryId,
      lines: [],
    }),
  });
  return { blocked: false, posting, record };
}
