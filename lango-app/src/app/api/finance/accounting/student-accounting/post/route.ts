import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  postStudentInvoice,
  postStudentPayment,
  STUDENT_INVOICE_MODULE,
  STUDENT_PAYMENT_MODULE,
} from '@/features/accounting/services/student-accounting-adapter';

const postSchema = z.object({
  documentType: z.enum(['invoice', 'payment']),
  documentId: z.string().uuid(),
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.voucher.post');
    const body = await parseJson(req, postSchema);
    const principal = { tenantId, userId: ctx.userId };
    const posting = { journalCode: body.journalCode, voucherTypeCode: body.voucherTypeCode };
    const result = body.documentType === 'invoice'
      ? await postStudentInvoice(principal, body.documentId, posting)
      : await postStudentPayment(principal, body.documentId, posting);

    if (result.blocked) {
      recordAudit(ctx, 'create', 'accounting_adapter_exception', result.exceptionId ?? body.documentId, {
        action: 'blocked',
        sourceModule: body.documentType === 'invoice' ? STUDENT_INVOICE_MODULE : STUDENT_PAYMENT_MODULE,
        reason: result.reason,
      });
      return NextResponse.json({ success: true, data: result });
    }
    recordAudit(ctx, 'create', 'journal_entry', result.entry.id, {
      action: 'adapter_posting',
      sourceModule: result.entry.sourceModule,
      sourceDocumentId: body.documentId,
      idempotent: result.idempotent,
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
