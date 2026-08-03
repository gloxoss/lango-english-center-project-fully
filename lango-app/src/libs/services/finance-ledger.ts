import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents, normalizeMoney } from '@/libs/finance/money';
import { chartOfAccounts, fiscalPeriods, journalEntries, journalEntryLines } from '@/models/Schema';

export type JournalLineInput = {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  memo?: string;
};

export type PostJournalInput = {
  tenantId: string;
  actorId: string;
  entryDate: string;
  description: string;
  sourceModule?: string;
  sourceId?: string;
  lines: JournalLineInput[];
};

export async function postBalancedJournal(input: PostJournalInput) {
  const normalized = input.lines.map((line) => {
    const debit = moneyToCents(line.debitAmount);
    const credit = moneyToCents(line.creditAmount);
    if ((debit > BigInt(0)) === (credit > BigInt(0))) {
      throw new ApiError(400, 'INVALID_JOURNAL_LINE', 'Chaque ligne doit avoir exactement un débit ou un crédit positif.');
    }
    return { ...line, debit, credit };
  });
  const debitTotal = normalized.reduce((sum, line) => sum + line.debit, BigInt(0));
  const creditTotal = normalized.reduce((sum, line) => sum + line.credit, BigInt(0));
  if (debitTotal !== creditTotal) {
    throw new ApiError(400, 'UNBALANCED_JOURNAL_ENTRY', 'Les totaux débit et crédit doivent être exactement égaux.');
  }

  return db.transaction(async (tx) => {
    const [openPeriod] = await tx.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(
      eq(fiscalPeriods.tenantId, input.tenantId),
      eq(fiscalPeriods.status, 'open'),
    ));
    if (!openPeriod) {
      throw new ApiError(409, 'NO_OPEN_FISCAL_PERIOD', 'Aucune période comptable ouverte ne permet cette écriture.');
    }

    const accountIds = [...new Set(normalized.map(line => line.accountId))];
    const accounts = await tx.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
      eq(chartOfAccounts.tenantId, input.tenantId),
      eq(chartOfAccounts.isActive, true),
      inArray(chartOfAccounts.id, accountIds),
    ));
    if (accounts.length !== accountIds.length) {
      throw new ApiError(422, 'INVALID_ACCOUNT', 'Une ligne référence un compte inactif ou externe à cet établissement.');
    }

    const [entry] = await tx.insert(journalEntries).values({
      tenantId: input.tenantId,
      entryNumber: `JE-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
      entryDate: input.entryDate,
      description: input.description,
      sourceModule: input.sourceModule ?? 'finance',
      sourceId: input.sourceId,
      postedById: input.actorId,
      status: 'posted',
    }).returning();
    if (!entry) {
      throw new ApiError(500, 'JOURNAL_INSERT_FAILED', 'Impossible de créer l’écriture comptable.');
    }

    const lines = normalized.map(line => ({
      tenantId: input.tenantId,
      journalEntryId: entry.id,
      accountId: line.accountId,
      debitAmount: normalizeMoney(line.debitAmount),
      creditAmount: normalizeMoney(line.creditAmount),
      memo: line.memo || null,
    }));
    await tx.insert(journalEntryLines).values(lines);
    return { entry, lines, totalDebit: centsToMoney(debitTotal), totalCredit: centsToMoney(creditTotal) };
  });
}
