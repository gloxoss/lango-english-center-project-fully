import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { postReconciliationFeeOrInterest } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  kind: z.enum(['fee', 'interest']),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  bankAssetAccountId: z.string().uuid(),
  offsetAccountId: z.string().uuid(),
  description: z.string().trim().min(1).max(1000),
  entryDate: z.string().date(),
  idempotencyKey: z.string().trim().min(8).max(160),
  journalCode: z.string().trim().min(1).max(20),
  voucherTypeCode: z.string().trim().min(1).max(30),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await postReconciliationFeeOrInterest({ tenantId, userId: ctx.userId }, id, body);
    recordAudit(ctx, 'create', 'journal_entry', result.journalEntryId, {
      action: result.eventType, reconciliationId: id, entryNumber: result.entryNumber,
    });
    return NextResponse.json({ success: true, data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
