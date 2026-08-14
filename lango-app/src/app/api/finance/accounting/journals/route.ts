import type { NextRequest } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { accountingJournals } from '@/models/Schema';

const journalSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  journalType: z.enum(['sales', 'cash', 'bank', 'purchase', 'general', 'opening', 'closing']),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const rows = await db.select().from(accountingJournals).where(eq(accountingJournals.tenantId, ctx.tenantId!)).orderBy(asc(accountingJournals.code));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.manage');
    const body = await parseJson(req, journalSchema);
    const [record] = await db.insert(accountingJournals).values({ tenantId: ctx.tenantId!, ...body }).returning();
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
