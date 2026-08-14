import type { NextRequest } from 'next/server';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { accountingJournalLinks, accountingJournals, accountingVoucherTypes, journalEntries, journalEntryLines } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 25) || 25));
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const search = url.searchParams.get('search')?.trim();
    const conditions = [eq(journalEntries.tenantId, ctx.tenantId!)];
    if (from) conditions.push(gte(journalEntries.entryDate, from));
    if (to) conditions.push(lte(journalEntries.entryDate, to));
    if (search) conditions.push(or(ilike(journalEntries.entryNumber, `%${search}%`), ilike(journalEntries.description, `%${search}%`))!);
    const base = db.select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      sourceModule: journalEntries.sourceModule,
      status: journalEntries.status,
      createdAt: journalEntries.createdAt,
      journalCode: accountingJournals.code,
      voucherTypeCode: accountingVoucherTypes.code,
      reversalOfEntryId: accountingJournalLinks.reversalOfEntryId,
      debitTotal: sql<string>`coalesce(sum(${journalEntryLines.debitAmount}), 0)::text`,
      creditTotal: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
    }).from(journalEntries)
      .innerJoin(journalEntryLines, and(eq(journalEntryLines.tenantId, journalEntries.tenantId), eq(journalEntryLines.journalEntryId, journalEntries.id)))
      .leftJoin(accountingJournalLinks, and(eq(accountingJournalLinks.tenantId, journalEntries.tenantId), eq(accountingJournalLinks.journalEntryId, journalEntries.id)))
      .leftJoin(accountingJournals, and(eq(accountingJournals.tenantId, journalEntries.tenantId), eq(accountingJournals.id, accountingJournalLinks.journalId)))
      .leftJoin(accountingVoucherTypes, and(eq(accountingVoucherTypes.tenantId, journalEntries.tenantId), eq(accountingVoucherTypes.id, accountingJournalLinks.voucherTypeId)))
      .where(and(...conditions))
      .groupBy(journalEntries.id, accountingJournals.code, accountingVoucherTypes.code, accountingJournalLinks.reversalOfEntryId)
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize);
    const [rows, count] = await Promise.all([
      base,
      db.select({ count: sql<number>`count(*)::int` }).from(journalEntries).where(and(...conditions)),
    ]);
    return NextResponse.json({ success: true, data: rows, meta: { page, pageSize, total: count[0]?.count ?? 0 } });
  } catch (error) { return apiErrorResponse(error); }
}
