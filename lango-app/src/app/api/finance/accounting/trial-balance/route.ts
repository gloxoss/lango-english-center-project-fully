import type { NextRequest } from 'next/server';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { chartOfAccounts, journalEntries, journalEntryLines } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.statement.read');
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const csv = url.searchParams.get('format') === 'csv';
    if (csv) await requireCapability(ctx, 'accounting.export');
    const conditions = [eq(journalEntries.tenantId, ctx.tenantId!), eq(journalEntries.status, 'posted')];
    if (from) conditions.push(gte(journalEntries.entryDate, from));
    if (to) conditions.push(lte(journalEntries.entryDate, to));
    const rows = await db.select({
      accountId: chartOfAccounts.id,
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.name,
      accountType: chartOfAccounts.accountType,
      debit: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),0)::text`,
      credit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}),0)::text`,
      balance: sql<string>`(coalesce(sum(${journalEntryLines.debitAmount}),0)-coalesce(sum(${journalEntryLines.creditAmount}),0))::text`,
    }).from(journalEntryLines)
      .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
      .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId)))
      .where(and(...conditions)).groupBy(chartOfAccounts.id).orderBy(asc(chartOfAccounts.code));
    const totals = rows.reduce((sum, row) => ({ debit: sum.debit + Number(row.debit), credit: sum.credit + Number(row.credit) }), { debit: 0, credit: 0 });
    const result = { success: true, data: rows, totals: { debit: totals.debit.toFixed(2), credit: totals.credit.toFixed(2), balanced: totals.debit.toFixed(2) === totals.credit.toFixed(2) }, filters: { from, to } };
    if (csv) {
      const body = [['accountCode', 'accountName', 'accountType', 'debit', 'credit', 'balance'], ...rows.map(row => [row.accountCode, row.accountName, row.accountType, row.debit, row.credit, row.balance])]
        .map(row => row.map(cell => /[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : String(cell)).join(','))
        .join('\n');
      return new NextResponse(body, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="trial-balance-${Date.now()}.csv"` },
      });
    }
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
