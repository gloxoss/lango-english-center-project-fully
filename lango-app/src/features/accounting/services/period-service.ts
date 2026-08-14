import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  accountingClosingBalances,
  accountingClosingRuns,
  accountingDocuments,
  accountingPeriodEvents,
  accountingPeriodReopenRequests,
  bankReconciliations,
  chartOfAccounts,
  fiscalPeriods,
  journalEntries,
  journalEntryLines,
} from '@/models/Schema';

export type PeriodPrincipal = { tenantId: string; userId: string };

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type ClosingBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  net: number;
};

// Close an open fiscal period: reject while un-posted documents or draft
// reconciliations remain, then capture an immutable ledger snapshot (per-account
// debit/credit/net within the period + posted-entry count) as the reproducible
// as-of evidence, and append the immutable 'closed' audit event. Idempotent for an
// already-closed period: returns the existing active closing run.
export async function closePeriod(
  principal: PeriodPrincipal,
  periodId: string,
  reason: string,
): Promise<{ period: typeof fiscalPeriods.$inferSelect; closingRun: typeof accountingClosingRuns.$inferSelect | null; alreadyClosed: boolean }> {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.tenantId, principal.tenantId), eq(fiscalPeriods.id, periodId)))
      .for('update');
    if (!period) throw new ApiError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Période introuvable.');

    const [existingRun] = await tx.select().from(accountingClosingRuns).where(and(
      eq(accountingClosingRuns.tenantId, principal.tenantId),
      eq(accountingClosingRuns.fiscalPeriodId, periodId),
      eq(accountingClosingRuns.superseded, false),
    )).limit(1);
    if (period.status === 'closed' && existingRun) {
      return { period, closingRun: existingRun, alreadyClosed: true };
    }

    const [pendingDocuments] = await tx.select({ count: sql<number>`count(*)::int` }).from(accountingDocuments).where(and(
      eq(accountingDocuments.tenantId, principal.tenantId),
      gte(accountingDocuments.documentDate, period.startDate),
      lte(accountingDocuments.documentDate, period.endDate),
      inArray(accountingDocuments.status, ['pending_approval', 'approved']),
    ));
    const [draftReconciliations] = await tx.select({ count: sql<number>`count(*)::int` }).from(bankReconciliations).where(and(
      eq(bankReconciliations.tenantId, principal.tenantId),
      eq(bankReconciliations.status, 'draft'),
      lte(bankReconciliations.statementDate, period.endDate),
    ));
    if ((pendingDocuments?.count ?? 0) > 0 || (draftReconciliations?.count ?? 0) > 0) {
      throw new ApiError(409, 'PERIOD_CLOSE_BLOCKED', 'Des pièces approuvées/non comptabilisées ou des rapprochements brouillons bloquent la clôture.');
    }

    const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(journalEntries).where(and(
      eq(journalEntries.tenantId, principal.tenantId),
      eq(journalEntries.status, 'posted'),
      gte(journalEntries.entryDate, period.startDate),
      lte(journalEntries.entryDate, period.endDate),
    ));

    const rows = await tx.select({
      accountId: journalEntryLines.accountId,
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.name,
      accountType: chartOfAccounts.accountType,
      debit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),0)::text`,
      credit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}),0)::text`,
    }).from(journalEntryLines)
      .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
      .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
      .where(and(
        eq(journalEntryLines.tenantId, principal.tenantId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, period.startDate),
        lte(journalEntries.entryDate, period.endDate),
      ))
      .groupBy(journalEntryLines.accountId, chartOfAccounts.id)
      .orderBy(asc(chartOfAccounts.code));

    const balances: ClosingBalanceRow[] = rows.map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      return { accountId: row.accountId, accountCode: row.accountCode, accountName: row.accountName, accountType: row.accountType, debit, credit, net: debit - credit };
    });
    let debitTotal = 0;
    let creditTotal = 0;
    for (const balance of balances) { debitTotal += balance.debit; creditTotal += balance.credit; }

    const [updated] = await tx.update(fiscalPeriods)
      .set({ status: 'closed', closedAt: new Date().toISOString(), closedById: principal.userId })
      .where(and(eq(fiscalPeriods.tenantId, principal.tenantId), eq(fiscalPeriods.id, periodId), eq(fiscalPeriods.status, 'open')))
      .returning();
    if (!updated) throw new ApiError(409, 'PERIOD_CLOSE_RACE', 'La période a changé pendant la clôture.');

    const [closingRun] = await tx.insert(accountingClosingRuns).values({
      tenantId: principal.tenantId,
      fiscalPeriodId: periodId,
      reason,
      closedById: principal.userId,
      periodEndDate: period.endDate,
      postedEntryCount: countRow?.count ?? 0,
      debitTotal: debitTotal.toFixed(2),
      creditTotal: creditTotal.toFixed(2),
      netBalance: '0',
    }).returning();
    if (!closingRun) throw new ApiError(500, 'CLOSE_FAILED', 'Échec de la création de l\'évidence de clôture.');

    if (balances.length > 0) {
      await tx.insert(accountingClosingBalances).values(balances.map((balance) => ({
        tenantId: principal.tenantId,
        closingRunId: closingRun.id,
        accountId: balance.accountId,
        accountCode: balance.accountCode,
        accountName: balance.accountName,
        accountType: balance.accountType,
        debitTotal: balance.debit.toFixed(2),
        creditTotal: balance.credit.toFixed(2),
        netBalance: balance.net.toFixed(2),
      })));
    }

    await tx.insert(accountingPeriodEvents).values({
      tenantId: principal.tenantId,
      fiscalPeriodId: periodId,
      eventType: 'closed',
      actorId: principal.userId,
      reason,
      metadata: { closingRunId: closingRun.id, postedEntryCount: countRow?.count ?? 0 },
    });

    return { period: updated, closingRun, alreadyClosed: false };
  });
}

// Two-step maker-checker reopen. Requesting requires the exceptional
// accounting.period.reopen capability (checked in the route); approving must be a
// DIFFERENT actor and performs the actual reopen.
export async function requestReopen(principal: PeriodPrincipal, periodId: string, reason: string): Promise<typeof accountingPeriodReopenRequests.$inferSelect> {
  const [period] = await db.select().from(fiscalPeriods)
    .where(and(eq(fiscalPeriods.tenantId, principal.tenantId), eq(fiscalPeriods.id, periodId)))
    .limit(1);
  if (!period) throw new ApiError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Période introuvable.');
  if (period.status !== 'closed') throw new ApiError(409, 'PERIOD_NOT_CLOSED', 'La période est introuvable ou déjà ouverte.');

  const [request] = await db.insert(accountingPeriodReopenRequests).values({
    tenantId: principal.tenantId,
    fiscalPeriodId: periodId,
    requestedById: principal.userId,
    reason,
  }).returning();
  if (!request) throw new ApiError(500, 'REOPEN_REQUEST_FAILED', 'Échec de la création de la demande de réouverture.');

  await db.insert(accountingPeriodEvents).values({
    tenantId: principal.tenantId,
    fiscalPeriodId: periodId,
    eventType: 'reopen_requested',
    actorId: principal.userId,
    reason,
  });
  return request;
}

export async function decideReopen(
  principal: PeriodPrincipal,
  requestId: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<{ period?: typeof fiscalPeriods.$inferSelect; request: typeof accountingPeriodReopenRequests.$inferSelect; supersededClosingRunId?: string | null }> {
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(accountingPeriodReopenRequests)
      .where(and(eq(accountingPeriodReopenRequests.tenantId, principal.tenantId), eq(accountingPeriodReopenRequests.id, requestId)))
      .for('update');
    if (!request) throw new ApiError(404, 'REOPEN_REQUEST_NOT_FOUND', 'Demande de réouverture introuvable.');
    if (request.status !== 'pending') throw new ApiError(409, 'REOPEN_REQUEST_DECIDED', 'Cette demande a déjà été traitée.');
    if (decision === 'approved' && request.requestedById === principal.userId) {
      throw new ApiError(409, 'REOPEN_MAKER_CHECKER', 'Le demandeur ne peut pas approuver sa propre réouverture.');
    }

    const now = new Date().toISOString();
    const reason = note ?? request.reason;
    if (decision === 'rejected') {
      const [decided] = await tx.update(accountingPeriodReopenRequests)
        .set({ status: 'rejected', decidedById: principal.userId, decidedAt: now, decisionNote: note ?? null })
        .where(eq(accountingPeriodReopenRequests.id, requestId))
        .returning();
      if (!decided) throw new ApiError(500, 'REOPEN_DECIDE_FAILED', 'Échec de l\'enregistrement de la décision.');
      await tx.insert(accountingPeriodEvents).values({
        tenantId: principal.tenantId,
        fiscalPeriodId: request.fiscalPeriodId,
        eventType: 'reopen_rejected',
        actorId: principal.userId,
        reason,
        metadata: { requestId },
      });
      return { request: decided };
    }

    const [period] = await tx.select().from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.tenantId, principal.tenantId), eq(fiscalPeriods.id, request.fiscalPeriodId)))
      .for('update');
    if (!period) throw new ApiError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Période introuvable.');
    if (period.status !== 'closed') throw new ApiError(409, 'PERIOD_NOT_CLOSED', 'La période n\'est pas clôturée.');

    const [updatedPeriod] = await tx.update(fiscalPeriods)
      .set({ status: 'open', closedAt: null, closedById: null })
      .where(and(
        eq(fiscalPeriods.tenantId, principal.tenantId),
        eq(fiscalPeriods.id, request.fiscalPeriodId),
        eq(fiscalPeriods.status, 'closed'),
      ))
      .returning();
    if (!updatedPeriod) throw new ApiError(409, 'PERIOD_REOPEN_RACE', 'La période a changé pendant la réouverture.');

    const [supersededRun] = await tx.update(accountingClosingRuns)
      .set({ superseded: true, supersededById: principal.userId, supersededAt: now })
      .where(and(
        eq(accountingClosingRuns.tenantId, principal.tenantId),
        eq(accountingClosingRuns.fiscalPeriodId, request.fiscalPeriodId),
        eq(accountingClosingRuns.superseded, false),
      ))
      .returning();

    const [decided] = await tx.update(accountingPeriodReopenRequests)
      .set({ status: 'approved', decidedById: principal.userId, decidedAt: now, decisionNote: note ?? null })
      .where(eq(accountingPeriodReopenRequests.id, requestId))
      .returning();
    if (!decided) throw new ApiError(500, 'REOPEN_DECIDE_FAILED', 'Échec de l\'enregistrement de la décision.');

    await tx.insert(accountingPeriodEvents).values({
      tenantId: principal.tenantId,
      fiscalPeriodId: request.fiscalPeriodId,
      eventType: 'reopen_approved',
      actorId: principal.userId,
      reason,
      metadata: { requestId, supersededClosingRunId: supersededRun?.id ?? null },
    });

    return { period: updatedPeriod, request: decided, supersededClosingRunId: supersededRun?.id ?? null };
  });
}

// The reproducible as-of evidence for a period: the pinned snapshot balances.
export async function getClosingBalances(
  principal: PeriodPrincipal,
  runId: string,
): Promise<{ run: typeof accountingClosingRuns.$inferSelect; balances: ClosingBalanceRow[] }> {
  const [run] = await db.select().from(accountingClosingRuns)
    .where(and(eq(accountingClosingRuns.tenantId, principal.tenantId), eq(accountingClosingRuns.id, runId)))
    .limit(1);
  if (!run) throw new ApiError(404, 'CLOSING_RUN_NOT_FOUND', 'Évidence de clôture introuvable.');
  const rows = await db.select({
    accountId: accountingClosingBalances.accountId,
    accountCode: accountingClosingBalances.accountCode,
    accountName: accountingClosingBalances.accountName,
    accountType: accountingClosingBalances.accountType,
    debit: sql<string>`${accountingClosingBalances.debitTotal}::text`,
    credit: sql<string>`${accountingClosingBalances.creditTotal}::text`,
  }).from(accountingClosingBalances)
    .where(and(eq(accountingClosingBalances.tenantId, principal.tenantId), eq(accountingClosingBalances.closingRunId, runId)))
    .orderBy(asc(accountingClosingBalances.accountCode));
  const balances: ClosingBalanceRow[] = rows.map((row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    return { accountId: row.accountId, accountCode: row.accountCode, accountName: row.accountName, accountType: row.accountType, debit, credit, net: debit - credit };
  });
  return { run, balances };
}
