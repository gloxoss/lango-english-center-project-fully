import type { NextRequest } from 'next/server';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { chartOfAccounts, journalEntries, journalEntryLines } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.statement.read');
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId');
    const from = url.searchParams.get('from') ?? '0001-01-01';
    const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 500) || 500));
    if (!accountId) throw new ApiError(422, 'ACCOUNT_REQUIRED', 'Le paramètre accountId est requis.');
    const [account] = await db.select({
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.name,
      accountType: chartOfAccounts.accountType,
    }).from(chartOfAccounts).where(and(
      eq(chartOfAccounts.tenantId, ctx.tenantId!),
      eq(chartOfAccounts.id, accountId),
    )).limit(1);
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Compte inconnu pour cet établissement.');

    const lines = await db.select({
      id: journalEntryLines.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      debit: journalEntryLines.debitAmount,
      credit: journalEntryLines.creditAmount,
      memo: journalEntryLines.memo,
    }).from(journalEntryLines)
      .innerJoin(journalEntries, and(eq(journalEntries.tenantId, journalEntryLines.tenantId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
      .where(and(
        eq(journalEntryLines.tenantId, ctx.tenantId!),
        eq(journalEntryLines.accountId, accountId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, from),
        lte(journalEntries.entryDate, to),
      ))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.entryNumber))
      .limit(limit);
    const creditNormal = ['liability', 'equity', 'revenue'].includes(account.accountType);
    let running = 0;
    const rows = lines.map((line) => {
      running += creditNormal ? Number(line.credit) - Number(line.debit) : Number(line.debit) - Number(line.credit);
      return { ...line, balance: running.toFixed(2) };
    });
    return NextResponse.json({ success: true, data: rows, meta: {
      accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType,
      from, to, limit, runningBalance: running.toFixed(2),
    } });
  } catch (error) { return apiErrorResponse(error); }
}
