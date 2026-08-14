import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { postAccountingVoucher } from '@/features/accounting/services/posting-service';
import { accountingJournalLinks, accountingPostingRequests, journalEntries } from '@/models/Schema';

const schema = z.object({
  entryDate: z.string().date(),
  receivedIntoAccountId: z.string().uuid(),
  offsetAccountId: z.string().uuid(),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0),
  reference: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  sourceVersion: z.number().int().positive().default(1),
  idempotencyKey: z.string().trim().min(8).max(160),
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const records = await db.select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      sourceDocumentId: accountingPostingRequests.sourceDocumentId,
      createdAt: journalEntries.createdAt,
    }).from(accountingPostingRequests)
      .innerJoin(accountingJournalLinks, and(eq(accountingJournalLinks.tenantId, accountingPostingRequests.tenantId), eq(accountingJournalLinks.postingRequestId, accountingPostingRequests.id)))
      .innerJoin(journalEntries, and(eq(journalEntries.tenantId, accountingPostingRequests.tenantId), eq(journalEntries.id, accountingJournalLinks.journalEntryId)))
      .where(and(eq(accountingPostingRequests.tenantId, ctx.tenantId!), eq(accountingPostingRequests.sourceModule, 'manual_deposit')))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt)).limit(100);
    return NextResponse.json({ success: true, data: records });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.deposit.create');
    const body = await parseJson(req, schema);
    const result = await postAccountingVoucher({
      tenantId: ctx.tenantId!, actorId: ctx.userId, entryDate: body.entryDate,
      description: body.description, sourceModule: 'manual_deposit', sourceDocumentId: body.reference,
      sourceVersion: body.sourceVersion, idempotencyKey: body.idempotencyKey, journalCode: body.journalCode,
      voucherTypeCode: body.voucherTypeCode,
      lines: [
        { accountId: body.receivedIntoAccountId, debitAmount: body.amount, creditAmount: '0', memo: body.reference },
        { accountId: body.offsetAccountId, debitAmount: '0', creditAmount: body.amount, memo: body.reference },
      ],
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
