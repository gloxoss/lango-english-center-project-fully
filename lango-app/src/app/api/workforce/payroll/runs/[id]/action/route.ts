import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability, type PermissionKey } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { approveRun, calculateRun, cancelRun, closeRun, markPaid, postRun, reverseRun, submitForReview } from '@/features/workforce/services/payroll-runs';

const schema = z.object({
  action: z.enum(['calculate', 'review', 'approve', 'post', 'paid', 'close', 'cancel', 'reverse']),
  regulationVersionId: z.string().uuid().nullable().optional(),
  journalCode: z.string().trim().min(1).max(20).default('PAY'),
  voucherTypeCode: z.string().trim().min(1).max(30).default('PAYROLL'),
  paymentBatchId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});
const capability: Record<z.infer<typeof schema>['action'], PermissionKey> = {
  calculate: 'payroll.calculate', review: 'payroll.review', approve: 'payroll.approve', post: 'payroll.post',
  paid: 'payroll.payment.reconcile', close: 'payroll.payment.reconcile', cancel: 'payroll.calculate', reverse: 'payroll.post',
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    const body = await parseJson(request, schema);
    await requireCapability(ctx, capability[body.action]);
    const { id } = await params;
    const actor = { tenantId, actorId: ctx.userId };
    const ref = { journalCode: body.journalCode, voucherTypeCode: body.voucherTypeCode };
    const data = body.action === 'calculate' ? await calculateRun(id, actor, body.regulationVersionId)
      : body.action === 'review' ? await submitForReview(id, actor)
      : body.action === 'approve' ? await approveRun(id, actor)
      : body.action === 'post' ? await postRun(id, actor, ref)
      : body.action === 'paid' ? await markPaid(id, actor, body.paymentBatchId)
      : body.action === 'close' ? await closeRun(id, actor)
      : body.action === 'cancel' ? await cancelRun(id, actor, body.reason)
      : await reverseRun(id, actor, ref);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
