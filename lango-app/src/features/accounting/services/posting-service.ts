import { createHash } from 'node:crypto';
import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents, normalizeMoney } from '@/libs/finance/money';
import {
  accountingJournalLinks,
  accountingJournals,
  accountingNumberingSeries,
  accountingPostingRequests,
  accountingVoucherEvents,
  accountingVoucherTypes,
  chartOfAccounts,
  fiscalPeriods,
  journalEntries,
  journalEntryLines,
} from '@/models/Schema';

export type AccountingPostingLine = {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  memo?: string;
};

export type AccountingPostingInput = {
  tenantId: string;
  actorId: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  sourceDocumentId: string;
  sourceVersion: number;
  idempotencyKey: string;
  journalCode: string;
  voucherTypeCode: string;
  lines: AccountingPostingLine[];
  reversalOfEntryId?: string;
  eventReason?: string;
};

/**
 * Versioned in-process posting contract (WA6). `postAccountingVoucher` accepts
 * `AccountingPostingInput` (above) and resolves to `AccountingPostingResult`
 * below. Source modules (Student Accounting, Payroll handoff, deposits,
 * expenses) must keep this shape stable; bump POSTING_CONTRACT_VERSION on any
 * breaking change.
 */
export const POSTING_CONTRACT_VERSION = '1.0';

export type AccountingPostingResult = {
  postingRequestId: string | null;
  entryNumber: string;
  entry: typeof journalEntries.$inferSelect;
  lines: typeof journalEntryLines.$inferSelect[];
  totalDebit: string;
  totalCredit: string;
  idempotent: boolean;
};

type NormalizedLine = AccountingPostingLine & { debit: bigint; credit: bigint };

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function accountingPayloadDigest(input: AccountingPostingInput): string {
  return createHash('sha256').update(JSON.stringify(stableValue(input))).digest('hex');
}

function normalizeLines(lines: AccountingPostingLine[]): {
  lines: NormalizedLine[];
  debitTotal: bigint;
  creditTotal: bigint;
} {
  if (lines.length < 2) {
    throw new ApiError(422, 'JOURNAL_LINES_REQUIRED', 'Une écriture comptable doit contenir au moins deux lignes.');
  }
  const normalized = lines.map((line) => {
    const debit = moneyToCents(line.debitAmount);
    const credit = moneyToCents(line.creditAmount);
    if ((debit > BigInt(0)) === (credit > BigInt(0))) {
      throw new ApiError(422, 'INVALID_JOURNAL_LINE', 'Chaque ligne doit avoir exactement un débit ou un crédit positif.');
    }
    return { ...line, debit, credit };
  });
  const debitTotal = normalized.reduce((sum, line) => sum + line.debit, BigInt(0));
  const creditTotal = normalized.reduce((sum, line) => sum + line.credit, BigInt(0));
  if (debitTotal !== creditTotal) {
    throw new ApiError(422, 'UNBALANCED_JOURNAL_ENTRY', 'Les totaux débit et crédit doivent être exactement égaux.');
  }
  return { lines: normalized, debitTotal, creditTotal };
}

async function loadPostedResult(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  journalEntryId: string,
  idempotent: boolean,
) {
  const [entry] = await tx.select().from(journalEntries).where(and(
    eq(journalEntries.tenantId, tenantId),
    eq(journalEntries.id, journalEntryId),
  ));
  if (!entry) throw new ApiError(500, 'POSTED_ENTRY_MISSING', 'La demande publiée ne référence aucune écriture.');
  const lines = await tx.select().from(journalEntryLines).where(and(
    eq(journalEntryLines.tenantId, tenantId),
    eq(journalEntryLines.journalEntryId, journalEntryId),
  ));
  const [link] = await tx.select({ postingRequestId: accountingJournalLinks.postingRequestId })
    .from(accountingJournalLinks)
    .where(and(
      eq(accountingJournalLinks.tenantId, tenantId),
      eq(accountingJournalLinks.journalEntryId, journalEntryId),
    )).limit(1);
  const totalDebit = lines.reduce((sum, line) => sum + moneyToCents(line.debitAmount), BigInt(0));
  const totalCredit = lines.reduce((sum, line) => sum + moneyToCents(line.creditAmount), BigInt(0));
  return {
    postingRequestId: link?.postingRequestId ?? null,
    entryNumber: entry.entryNumber,
    entry,
    lines,
    totalDebit: centsToMoney(totalDebit),
    totalCredit: centsToMoney(totalCredit),
    idempotent,
  };
}

export async function postAccountingVoucher(input: AccountingPostingInput) {
  const normalized = normalizeLines(input.lines);
  if (!Number.isSafeInteger(input.sourceVersion) || input.sourceVersion < 1) {
    throw new ApiError(422, 'INVALID_SOURCE_VERSION', 'La version du document source doit être un entier positif.');
  }
  const digest = accountingPayloadDigest(input);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${input.tenantId}:posting:${input.idempotencyKey}`}, 0))`);

    const [prior] = await tx.select().from(accountingPostingRequests).where(and(
      eq(accountingPostingRequests.tenantId, input.tenantId),
      or(
        eq(accountingPostingRequests.idempotencyKey, input.idempotencyKey),
        and(
          eq(accountingPostingRequests.sourceModule, input.sourceModule),
          eq(accountingPostingRequests.sourceDocumentId, input.sourceDocumentId),
          eq(accountingPostingRequests.sourceVersion, input.sourceVersion),
        ),
      ),
    ));
    if (prior) {
      if (prior.payloadDigest !== digest) {
        throw new ApiError(409, 'POSTING_REQUEST_CONFLICT', 'Cette clé ou version source a déjà été utilisée avec un contenu différent.');
      }
      if (prior.status === 'succeeded' && prior.journalEntryId) {
        return loadPostedResult(tx, input.tenantId, prior.journalEntryId, true);
      }
      throw new ApiError(409, 'POSTING_REQUEST_IN_PROGRESS', 'Cette écriture comptable est déjà en cours de traitement.');
    }

    const [period] = await tx.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(
      eq(fiscalPeriods.tenantId, input.tenantId),
      eq(fiscalPeriods.status, 'open'),
      lte(fiscalPeriods.startDate, input.entryDate),
      gte(fiscalPeriods.endDate, input.entryDate),
    ));
    if (!period) throw new ApiError(409, 'FISCAL_PERIOD_CLOSED', 'Aucune période ouverte ne couvre la date de cette écriture.');

    const [voucher] = await tx.select({
      id: accountingVoucherTypes.id,
      journalId: accountingVoucherTypes.journalId,
      sourceModule: accountingVoucherTypes.sourceModule,
    }).from(accountingVoucherTypes).innerJoin(accountingJournals, and(
      eq(accountingJournals.tenantId, accountingVoucherTypes.tenantId),
      eq(accountingJournals.id, accountingVoucherTypes.journalId),
    )).where(and(
      eq(accountingVoucherTypes.tenantId, input.tenantId),
      eq(accountingVoucherTypes.code, input.voucherTypeCode),
      eq(accountingVoucherTypes.isActive, true),
      eq(accountingJournals.code, input.journalCode),
      eq(accountingJournals.isActive, true),
    ));
    if (!voucher) throw new ApiError(422, 'INVALID_VOUCHER_TYPE', 'Le journal ou le type de pièce est inactif ou inconnu.');
    if (voucher.sourceModule && voucher.sourceModule !== input.sourceModule) {
      throw new ApiError(422, 'VOUCHER_SOURCE_MISMATCH', 'Ce type de pièce est réservé à un autre module source.');
    }

    const accountIds = [...new Set(normalized.lines.map(line => line.accountId))];
    const accounts = await tx.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
      eq(chartOfAccounts.tenantId, input.tenantId),
      eq(chartOfAccounts.isActive, true),
      inArray(chartOfAccounts.id, accountIds),
    ));
    if (accounts.length !== accountIds.length) {
      throw new ApiError(422, 'INVALID_ACCOUNT', 'Une ligne référence un compte inactif ou appartenant à un autre établissement.');
    }

    if (input.reversalOfEntryId) {
      const [original] = await tx.select({ id: journalEntries.id }).from(journalEntries).where(and(
        eq(journalEntries.tenantId, input.tenantId),
        eq(journalEntries.id, input.reversalOfEntryId),
      ));
      if (!original) throw new ApiError(404, 'REVERSAL_SOURCE_NOT_FOUND', 'L’écriture à contrepasser est introuvable.');
    }

    const [request] = await tx.insert(accountingPostingRequests).values({
      tenantId: input.tenantId,
      sourceModule: input.sourceModule,
      sourceDocumentId: input.sourceDocumentId,
      sourceVersion: input.sourceVersion,
      idempotencyKey: input.idempotencyKey,
      payloadDigest: digest,
      status: 'processing',
      createdById: input.actorId,
    }).returning({ id: accountingPostingRequests.id });
    if (!request) throw new ApiError(500, 'POSTING_REQUEST_INSERT_FAILED', 'Impossible de réserver la demande de comptabilisation.');

    const fiscalYear = Number(input.entryDate.slice(0, 4));
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${input.tenantId}:numbering:${voucher.journalId}:${fiscalYear}`}, 0))`);
    await tx.insert(accountingNumberingSeries).values({
      tenantId: input.tenantId,
      journalId: voucher.journalId,
      fiscalYear,
      prefix: `${input.journalCode}-${fiscalYear}-`,
      nextValue: 1,
      padding: 6,
    }).onConflictDoNothing();
    const [series] = await tx.select().from(accountingNumberingSeries).where(and(
      eq(accountingNumberingSeries.tenantId, input.tenantId),
      eq(accountingNumberingSeries.journalId, voucher.journalId),
      eq(accountingNumberingSeries.fiscalYear, fiscalYear),
    )).for('update');
    if (!series) throw new ApiError(500, 'NUMBERING_SERIES_MISSING', 'La séquence du journal est introuvable.');
    const entryNumber = `${series.prefix}${String(series.nextValue).padStart(series.padding, '0')}`;
    await tx.update(accountingNumberingSeries).set({
      nextValue: series.nextValue + 1,
      updatedAt: new Date().toISOString(),
    }).where(eq(accountingNumberingSeries.id, series.id));

    const [entry] = await tx.insert(journalEntries).values({
      tenantId: input.tenantId,
      entryNumber,
      entryDate: input.entryDate,
      description: input.description,
      sourceModule: input.sourceModule,
      postedById: input.actorId,
      status: 'posted',
    }).returning();
    if (!entry) throw new ApiError(500, 'JOURNAL_INSERT_FAILED', 'Impossible de créer l’écriture comptable.');

    const lineValues = normalized.lines.map(line => ({
      tenantId: input.tenantId,
      journalEntryId: entry.id,
      accountId: line.accountId,
      debitAmount: normalizeMoney(line.debitAmount),
      creditAmount: normalizeMoney(line.creditAmount),
      memo: line.memo?.trim() || null,
    }));
    const lines = await tx.insert(journalEntryLines).values(lineValues).returning();
    await tx.insert(accountingJournalLinks).values({
      tenantId: input.tenantId,
      journalEntryId: entry.id,
      journalId: voucher.journalId,
      voucherTypeId: voucher.id,
      postingRequestId: request.id,
      reversalOfEntryId: input.reversalOfEntryId,
    });
    await tx.insert(accountingVoucherEvents).values({
      tenantId: input.tenantId,
      journalEntryId: entry.id,
      eventType: input.reversalOfEntryId ? 'reversed' : 'posted',
      actorId: input.actorId,
      reason: input.eventReason,
      metadata: { sourceModule: input.sourceModule, sourceDocumentId: input.sourceDocumentId, sourceVersion: input.sourceVersion },
    });
    await tx.update(accountingPostingRequests).set({
      status: 'succeeded',
      journalEntryId: entry.id,
      completedAt: new Date().toISOString(),
    }).where(eq(accountingPostingRequests.id, request.id));

    return {
      postingRequestId: request.id,
      entryNumber,
      entry,
      lines,
      totalDebit: centsToMoney(normalized.debitTotal),
      totalCredit: centsToMoney(normalized.creditTotal),
      idempotent: false,
    };
  });
}

export async function reverseAccountingVoucher(input: Omit<AccountingPostingInput, 'lines' | 'reversalOfEntryId'> & {
  originalEntryId: string;
}) {
  const originalLines = await db.select({
    accountId: journalEntryLines.accountId,
    debitAmount: journalEntryLines.debitAmount,
    creditAmount: journalEntryLines.creditAmount,
    memo: journalEntryLines.memo,
  }).from(journalEntryLines).innerJoin(journalEntries, and(
    eq(journalEntries.tenantId, journalEntryLines.tenantId),
    eq(journalEntries.id, journalEntryLines.journalEntryId),
  )).where(and(
    eq(journalEntries.tenantId, input.tenantId),
    eq(journalEntries.id, input.originalEntryId),
  ));
  if (originalLines.length < 2) throw new ApiError(404, 'REVERSAL_SOURCE_NOT_FOUND', 'L’écriture à contrepasser est introuvable.');
  return postAccountingVoucher({
    ...input,
    reversalOfEntryId: input.originalEntryId,
    lines: originalLines.map(line => ({
      accountId: line.accountId,
      debitAmount: line.creditAmount,
      creditAmount: line.debitAmount,
      memo: line.memo ? `Contrepassation: ${line.memo}` : 'Contrepassation',
    })),
  });
}
