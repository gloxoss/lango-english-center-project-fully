import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { accountingDocuments } from '@/models/Schema';

const schema = z.object({
  documentDate: z.string().date(),
  reference: z.string().trim().min(1).max(160),
  counterparty: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(1000),
  expenseAccountId: z.string().uuid(),
  settlementAccountId: z.string().uuid(),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.account.read');
    const records = await db.select().from(accountingDocuments).where(and(
      eq(accountingDocuments.tenantId, ctx.tenantId!), eq(accountingDocuments.documentType, 'expense'),
    )).orderBy(desc(accountingDocuments.documentDate), desc(accountingDocuments.createdAt)).limit(100);
    return NextResponse.json({ success: true, data: records });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.expense.prepare');
    const body = await parseJson(req, schema);
    const record = await createAccountingDocument({
      tenantId: ctx.tenantId!, actorId: ctx.userId, documentType: 'expense', documentDate: body.documentDate,
      reference: body.reference, counterparty: body.counterparty, description: body.description,
      lines: [
        { accountId: body.expenseAccountId, debitAmount: body.amount, creditAmount: '0', memo: body.reference },
        { accountId: body.settlementAccountId, debitAmount: '0', creditAmount: body.amount, memo: body.reference },
      ],
    });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
