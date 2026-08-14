import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { postAccountingVoucher } from '@/features/accounting/services/posting-service';

const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const schema = z.object({
  entryDate: z.string().date(),
  description: z.string().trim().min(1).max(1000),
  sourceDocumentId: z.string().trim().min(1).max(200),
  sourceVersion: z.number().int().positive().default(1),
  idempotencyKey: z.string().trim().min(8).max(160),
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
  lines: z.array(z.object({
    accountId: z.string().uuid(), debitAmount: money, creditAmount: money, memo: z.string().trim().max(500).optional(),
  }).strict()).min(2).max(200),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.journal.create');
    await requireCapability(ctx, 'accounting.voucher.post');
    const body = await parseJson(req, schema);
    const result = await postAccountingVoucher({
      tenantId: ctx.tenantId!, actorId: ctx.userId, sourceModule: 'manual_journal', ...body,
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
