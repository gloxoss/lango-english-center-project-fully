import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { reverseAccountingVoucher } from '@/features/accounting/services/posting-service';

const schema = z.object({
  entryDate: z.string().date(),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.string().trim().min(8).max(160),
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
  sourceVersion: z.number().int().positive().default(1),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'accounting.voucher.reverse');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await reverseAccountingVoucher({
      tenantId: ctx.tenantId!,
      actorId: ctx.userId,
      originalEntryId: id,
      entryDate: body.entryDate,
      description: `Contrepassation: ${body.reason}`,
      sourceModule: 'accounting_reversal',
      sourceDocumentId: id,
      sourceVersion: body.sourceVersion,
      idempotencyKey: body.idempotencyKey,
      journalCode: body.journalCode,
      voucherTypeCode: body.voucherTypeCode,
      eventReason: body.reason,
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
