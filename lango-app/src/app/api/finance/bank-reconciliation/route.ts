import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { normalizeMoney } from '@/libs/finance/money';
import { bankAccounts, bankReconciliations } from '@/models/Schema';

const createReconciliationDraftSchema = z.object({
  bankAccountId: z.string().uuid(),
  statementDate: z.string().date(),
  statementBalance: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  reconciledBalance: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const accounts = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.tenantId, ctx.tenantId!))
      .orderBy(desc(bankAccounts.createdAt));

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.manage');

    const body = await parseJson(req, createReconciliationDraftSchema);
    const tenantId = ctx.tenantId!;
    const [account] = await db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(
      eq(bankAccounts.id, body.bankAccountId),
      eq(bankAccounts.tenantId, tenantId),
    )).limit(1);
    if (!account) {
      throw new ApiError(422, 'INVALID_BANK_ACCOUNT', 'Compte bancaire invalide pour cet établissement.');
    }

    const [reconciliation] = await db
      .insert(bankReconciliations)
      .values({
        tenantId,
        bankAccountId: body.bankAccountId,
        statementDate: body.statementDate,
        statementBalance: normalizeMoney(body.statementBalance),
        reconciledBalance: normalizeMoney(body.reconciledBalance),
        status: 'draft',
        reconciledById: ctx.userId,
      })
      .returning();

    return NextResponse.json({ success: true, data: reconciliation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
