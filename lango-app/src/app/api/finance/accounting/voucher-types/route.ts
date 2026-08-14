import type { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { accountingJournals, accountingVoucherTypes } from '@/models/Schema';

const createVoucherType = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  journalId: z.string().uuid(),
  sourceModule: z.string().trim().min(1).max(60).nullable().optional(),
  requiresApproval: z.boolean().default(true),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const rows = await db.select({
      id: accountingVoucherTypes.id,
      code: accountingVoucherTypes.code,
      name: accountingVoucherTypes.name,
      sourceModule: accountingVoucherTypes.sourceModule,
      requiresApproval: accountingVoucherTypes.requiresApproval,
      isSystem: accountingVoucherTypes.isSystem,
      isActive: accountingVoucherTypes.isActive,
      journalId: accountingJournals.id,
      journalCode: accountingJournals.code,
      journalName: accountingJournals.name,
      journalType: accountingJournals.journalType,
    }).from(accountingVoucherTypes).innerJoin(accountingJournals, and(
      eq(accountingJournals.tenantId, accountingVoucherTypes.tenantId),
      eq(accountingJournals.id, accountingVoucherTypes.journalId),
    )).where(eq(accountingVoucherTypes.tenantId, ctx.tenantId!)).orderBy(asc(accountingVoucherTypes.code));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.manage');
    const body = await parseJson(req, createVoucherType);
    const journal = await db.select({ id: accountingJournals.id }).from(accountingJournals).where(and(
      eq(accountingJournals.tenantId, ctx.tenantId!), eq(accountingJournals.id, body.journalId), eq(accountingJournals.isActive, true),
    )).limit(1);
    if (!journal.length) throw new ApiError(422, 'JOURNAL_NOT_FOUND', 'Journal actif introuvable.');
    const [record] = await db.insert(accountingVoucherTypes).values({ tenantId: ctx.tenantId!, ...body }).returning();
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
