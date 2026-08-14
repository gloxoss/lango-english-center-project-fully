import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { LIBRARY_CHARGE_MODULE, postLibraryCharge } from '@/features/library/services/library-accounting-adapter';

const schema = z.object({
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
}).strict();

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'accounting.voucher.post');
    const { id } = await params;
    const body = await parseJson(r, schema);
    const result = await postLibraryCharge(
      { tenantId, userId: context.userId },
      id,
      { journalCode: body.journalCode, voucherTypeCode: body.voucherTypeCode },
    );

    if (result.blocked) {
      recordAudit(context, 'create', 'accounting_adapter_exception', result.exceptionId ?? id, {
        action: 'blocked', sourceModule: LIBRARY_CHARGE_MODULE, reason: result.reason,
      });
      return NextResponse.json({ success: true, data: result });
    }
    recordAudit(context, 'create', 'journal_entry', result.entry.id, {
      action: 'adapter_posting', sourceModule: LIBRARY_CHARGE_MODULE, sourceDocumentId: id, idempotent: result.idempotent,
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (e) { return apiErrorResponse(e); }
}
