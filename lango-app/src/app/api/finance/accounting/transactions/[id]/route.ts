import type { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { accountingJournalLinks, accountingVoucherEvents, chartOfAccounts, journalEntries, journalEntryLines } from '@/models/Schema';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const { id } = await params;
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.tenantId, ctx.tenantId!), eq(journalEntries.id, id)));
    if (!entry) throw new ApiError(404, 'JOURNAL_ENTRY_NOT_FOUND', 'Écriture introuvable.');
    const [lines, events, links] = await Promise.all([
      db.select({ id: journalEntryLines.id, accountId: chartOfAccounts.id, accountCode: chartOfAccounts.code, accountName: chartOfAccounts.name, debitAmount: journalEntryLines.debitAmount, creditAmount: journalEntryLines.creditAmount, memo: journalEntryLines.memo }).from(journalEntryLines).innerJoin(chartOfAccounts, and(eq(chartOfAccounts.tenantId, journalEntryLines.tenantId), eq(chartOfAccounts.id, journalEntryLines.accountId))).where(and(eq(journalEntryLines.tenantId, ctx.tenantId!), eq(journalEntryLines.journalEntryId, id))).orderBy(asc(chartOfAccounts.code)),
      db.select().from(accountingVoucherEvents).where(and(eq(accountingVoucherEvents.tenantId, ctx.tenantId!), eq(accountingVoucherEvents.journalEntryId, id))).orderBy(asc(accountingVoucherEvents.createdAt)),
      db.select().from(accountingJournalLinks).where(and(eq(accountingJournalLinks.tenantId, ctx.tenantId!), eq(accountingJournalLinks.journalEntryId, id))),
    ]);
    return NextResponse.json({ success: true, data: { entry, lines, events, link: links[0] ?? null } });
  } catch (error) { return apiErrorResponse(error); }
}
