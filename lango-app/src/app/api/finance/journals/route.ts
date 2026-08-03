import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { postBalancedJournal } from '@/libs/services/finance-ledger';
import { journalEntries } from '@/models/Schema';

const moneySchema = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const postJournalSchema = z.object({
  entryDate: z.string().date(),
  description: z.string().trim().min(1).max(1000),
  sourceModule: z.string().trim().min(1).max(50).optional(),
  sourceId: z.string().uuid().optional(),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    debitAmount: moneySchema.default('0'),
    creditAmount: moneySchema.default('0'),
    memo: z.string().trim().max(500).optional(),
  }).strict()).min(2),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');
    const entries = await db.select().from(journalEntries).where(eq(journalEntries.tenantId, ctx.tenantId!)).orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.manage');
    const body = await parseJson(req, postJournalSchema);
    const result = await postBalancedJournal({
      tenantId: ctx.tenantId!,
      actorId: ctx.userId,
      ...body,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
