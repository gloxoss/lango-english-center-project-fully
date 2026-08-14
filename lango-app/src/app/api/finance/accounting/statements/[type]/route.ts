import type { NextRequest } from 'next/server';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { accountingClosingBalances, accountingClosingRuns, chartOfAccounts, journalEntries, journalEntryLines } from '@/models/Schema';

type StatementRow = { accountCode: string; accountName: string; accountType: string; debit: string; credit: string };
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
const STATEMENT_TYPES = ['profit-loss', 'balance-sheet', 'general-ledger', 'cash-flow'] as const;
const CREDIT_NORMAL = new Set(['liability', 'equity', 'revenue']);

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.statement.read');
    const { type } = await params;
    if (!(STATEMENT_TYPES as readonly string[]).includes(type)) throw new ApiError(404, 'STATEMENT_NOT_FOUND', 'État financier inconnu.');
    const url = new URL(req.url);
    const asOf = url.searchParams.get('asOf') ?? new Date().toISOString().slice(0, 10);
    const runId = url.searchParams.get('runId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const accountTypes: AccountType[] = type === 'profit-loss' ? ['revenue', 'expense'] : ['asset', 'liability', 'equity'];
    const csv = url.searchParams.get('format') === 'csv';
    if (csv) await requireCapability(ctx, 'accounting.export');

    let data: Record<string, unknown>[];
    let meta: Record<string, unknown>;

    if (type === 'general-ledger') {
      const result = await generalLedger(ctx.tenantId!, from ?? null, to ?? null);
      data = result.rows; meta = result.meta;
    } else if (type === 'cash-flow') {
      const result = await cashFlow(ctx.tenantId!, from ?? null, to ?? null);
      data = result.rows; meta = result.meta;
    } else if (runId) {
      // Reproducible-as-of: read the immutable closing snapshot pinned at close.
      const [run] = await db.select().from(accountingClosingRuns).where(and(
        eq(accountingClosingRuns.tenantId, ctx.tenantId!),
        eq(accountingClosingRuns.id, runId),
      )).limit(1);
      if (!run) throw new ApiError(404, 'CLOSING_RUN_NOT_FOUND', 'Évidence de clôture introuvable.');
      const snapshot = await db.select({
        accountCode: accountingClosingBalances.accountCode,
        accountName: accountingClosingBalances.accountName,
        accountType: accountingClosingBalances.accountType,
        debit: sql<string>`${accountingClosingBalances.debitTotal}::text`,
        credit: sql<string>`${accountingClosingBalances.creditTotal}::text`,
      }).from(accountingClosingBalances)
        .where(and(
          eq(accountingClosingBalances.tenantId, ctx.tenantId!),
          eq(accountingClosingBalances.closingRunId, runId),
          inArray(accountingClosingBalances.accountType, accountTypes),
        ))
        .orderBy(asc(accountingClosingBalances.accountCode));
      data = signed(snapshot, type);
      meta = { type, asOf: run.periodEndDate, basis: `closing-snapshot:${run.id}`, currency: 'MAD', closingRunId: run.id, superseded: run.superseded };
    } else {
      const rows = await db.select({
        accountCode: chartOfAccounts.code, accountName: chartOfAccounts.name, accountType: chartOfAccounts.accountType,
        debit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),0)::text`,
        credit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}),0)::text`,
      }).from(journalEntryLines)
        .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
        .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
        .where(and(eq(journalEntries.tenantId, ctx.tenantId!), eq(journalEntries.status, 'posted'), lte(journalEntries.entryDate, asOf), inArray(chartOfAccounts.accountType, accountTypes)))
        .groupBy(chartOfAccounts.id).orderBy(asc(chartOfAccounts.code));
      data = signed(rows, type);
      meta = { type, asOf, basis: 'posted-general-ledger', currency: 'MAD' };
      if (type === 'balance-sheet') {
        const result = await periodResult(ctx.tenantId!, asOf);
        const signedRows = data as Array<StatementRow & { amount: string }>;
        const creditTotal = (t: AccountType) => signedRows.filter(r => r.accountType === t).reduce((sum, r) => sum + Number(r.amount), 0);
        const assets = creditTotal('asset');
        if (result !== 0) {
          signedRows.push({ accountCode: 'RESULT', accountName: 'Résultat de l’exercice', accountType: 'equity', debit: (result < 0 ? -result : 0).toFixed(2), credit: (result > 0 ? result : 0).toFixed(2), amount: result.toFixed(2) });
        }
        meta = { ...meta, result: result.toFixed(2), balanced: assets === creditTotal('liability') + creditTotal('equity') + result };
      }
    }

    if (csv) {
      const filename = `${type}-${Date.now()}.csv`;
      return new NextResponse(rowsToCsv(data), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    return NextResponse.json({ success: true, data, meta });
  } catch (error) { return apiErrorResponse(error); }
}

type GlRow = {
  accountCode: string; accountName: string; accountType: string;
  openingDebit: string; openingCredit: string; openingBalance: string;
  periodDebit: string; periodCredit: string; periodBalance: string;
  closingDebit: string; closingCredit: string; closingBalance: string;
};

async function generalLedger(tenantId: string, from: string | null, to: string | null): Promise<{ rows: GlRow[]; meta: Record<string, unknown> }> {
  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = from ?? '0001-01-01';
  const rows = await db.select({
    accountCode: chartOfAccounts.code, accountName: chartOfAccounts.name, accountType: chartOfAccounts.accountType,
    openingDebit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}) filter (where ${journalEntries.entryDate} < ${fromDate}),0)::text`,
    openingCredit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}) filter (where ${journalEntries.entryDate} < ${fromDate}),0)::text`,
    periodDebit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}) filter (where ${journalEntries.entryDate} >= ${fromDate} and ${journalEntries.entryDate} <= ${toDate}),0)::text`,
    periodCredit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}) filter (where ${journalEntries.entryDate} >= ${fromDate} and ${journalEntries.entryDate} <= ${toDate}),0)::text`,
    closingDebit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}) filter (where ${journalEntries.entryDate} <= ${toDate}),0)::text`,
    closingCredit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}) filter (where ${journalEntries.entryDate} <= ${toDate}),0)::text`,
  }).from(journalEntryLines)
    .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
    .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
    .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, 'posted'), lte(journalEntries.entryDate, toDate)))
    .groupBy(chartOfAccounts.id).orderBy(asc(chartOfAccounts.code));
  const gl: GlRow[] = rows.map((row) => {
    const normal = CREDIT_NORMAL.has(row.accountType as AccountType);
    const signed = (debit: string, credit: string) => (normal ? Number(credit) - Number(debit) : Number(debit) - Number(credit));
    return {
      ...row,
      openingBalance: signed(row.openingDebit, row.openingCredit).toFixed(2),
      periodBalance: signed(row.periodDebit, row.periodCredit).toFixed(2),
      closingBalance: signed(row.closingDebit, row.closingCredit).toFixed(2),
    };
  });
  const totals = gl.reduce((sum, row) => ({
    debit: sum.debit + Number(row.periodDebit),
    credit: sum.credit + Number(row.periodCredit),
  }), { debit: 0, credit: 0 });
  return {
    rows: gl,
    meta: { type: 'general-ledger', from: from ?? null, to: toDate, basis: 'posted-general-ledger', currency: 'MAD', balanced: totals.debit.toFixed(2) === totals.credit.toFixed(2) },
  };
}

type CashFlowRow = { section: string; label: string; amount: string };

async function cashFlow(tenantId: string, from: string | null, to: string | null): Promise<{ rows: CashFlowRow[]; meta: Record<string, unknown> }> {
  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = from ?? '0001-01-01';
  const period = await db.select({
    accountCode: chartOfAccounts.code, accountName: chartOfAccounts.name, accountType: chartOfAccounts.accountType,
    debit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),0)::text`,
    credit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}),0)::text`,
  }).from(journalEntryLines)
    .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
    .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
    .where(and(
      eq(journalEntries.tenantId, tenantId),
      eq(journalEntries.status, 'posted'),
      gte(journalEntries.entryDate, fromDate),
      lte(journalEntries.entryDate, toDate),
    ))
    .groupBy(chartOfAccounts.id).orderBy(asc(chartOfAccounts.code));

  const signedDelta = (row: { accountType: string; debit: string; credit: string }) =>
    CREDIT_NORMAL.has(row.accountType) ? Number(row.credit) - Number(row.debit) : Number(row.debit) - Number(row.credit);

  const sum = (rows: typeof period, key: 'debit' | 'credit') => rows.reduce((acc, row) => acc + Number(row[key]), 0);
  const isTreasury = (row: { accountType: string; accountCode: string }) => row.accountType === 'asset' && /^5/.test(row.accountCode);

  const treasury = period.filter(isTreasury);
  const treasuryDelta = treasury.reduce((acc, row) => acc + signedDelta(row), 0);
  const nonTreasuryAssets = period.filter(row => row.accountType === 'asset' && !isTreasury(row));
  const liabilities = period.filter(row => row.accountType === 'liability');
  const equity = period.filter(row => row.accountType === 'equity');
  const revenues = period.filter(row => row.accountType === 'revenue');
  const expenses = period.filter(row => row.accountType === 'expense');

  const revenueDelta = revenues.reduce((acc, row) => acc + signedDelta(row), 0);
  const expenseDelta = expenses.reduce((acc, row) => acc + signedDelta(row), 0);
  const netResult = revenueDelta - expenseDelta;
  const wcAssets = -nonTreasuryAssets.reduce((acc, row) => acc + signedDelta(row), 0);
  const liabilitiesDelta = liabilities.reduce((acc, row) => acc + signedDelta(row), 0);
  const equityDelta = equity.reduce((acc, row) => acc + signedDelta(row), 0);

  const operating = netResult + wcAssets + liabilitiesDelta;
  const financing = equityDelta;
  const investing = 0;
  const netChange = operating + financing + investing;

  const [treasuryDebit, treasuryCredit] = [sum(treasury, 'debit'), sum(treasury, 'credit')];
  const rows: CashFlowRow[] = [
    { section: 'operating', label: 'Résultat net', amount: netResult.toFixed(2) },
    { section: 'operating', label: 'Variation des actifs non-trésorerie', amount: wcAssets.toFixed(2) },
    { section: 'operating', label: 'Variation des passifs', amount: liabilitiesDelta.toFixed(2) },
    { section: 'operating', label: 'Flux nets d’exploitation', amount: operating.toFixed(2) },
    { section: 'financing', label: 'Variation des capitaux propres', amount: financing.toFixed(2) },
    { section: 'investing', label: 'Investissements (non classés)', amount: investing.toFixed(2) },
    { section: 'total', label: 'Variation de trésorerie (modèle indirect)', amount: netChange.toFixed(2) },
    { section: 'treasury', label: 'Trésorerie — débit', amount: treasuryDebit.toFixed(2) },
    { section: 'treasury', label: 'Trésorerie — crédit', amount: treasuryCredit.toFixed(2) },
    { section: 'treasury', label: 'Trésorerie — variation réelle', amount: treasuryDelta.toFixed(2) },
  ];
  return {
    rows,
    meta: {
      type: 'cash-flow', from: from ?? null, to: toDate, basis: 'posted-general-ledger', currency: 'MAD',
      // Accounting identity the report must satisfy:
      equation: 'operating + investing + financing = netChangeTreasury',
      netChangeTreasury: treasuryDelta.toFixed(2), modeledNetChange: netChange.toFixed(2), reconciled: treasuryDelta === netChange,
    },
  };
}

async function periodResult(tenantId: string, asOf: string): Promise<number> {
  const rows = await db.select({
    accountType: chartOfAccounts.accountType,
    debit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),0)::text`,
    credit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}),0)::text`,
  }).from(journalEntryLines)
    .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
    .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
    .where(and(
      eq(journalEntries.tenantId, tenantId),
      eq(journalEntries.status, 'posted'),
      lte(journalEntries.entryDate, asOf),
      inArray(chartOfAccounts.accountType, ['revenue', 'expense']),
    ))
    .groupBy(chartOfAccounts.accountType);
  let result = 0;
  for (const row of rows) {
    if (row.accountType === 'revenue') result += Number(row.credit) - Number(row.debit);
    else result -= Number(row.debit) - Number(row.credit);
  }
  return result;
}

function signed(rows: StatementRow[], type: string): Array<StatementRow & { amount: string }> {
  return rows.map((row) => ({
    ...row,
    amount: (CREDIT_NORMAL.has(row.accountType) ? Number(row.credit) - Number(row.debit) : Number(row.debit) - Number(row.credit)).toFixed(2),
  }));
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return '';
  const headers = Object.keys(first);
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
}
