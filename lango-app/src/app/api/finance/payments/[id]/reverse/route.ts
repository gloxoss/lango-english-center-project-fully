import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { createPaymentReversal } from '@/libs/services/payment-reversal';

const reverseSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
}).strict();

// POST /api/finance/payments/:id/reverse — request a payment reversal. A
// finance.manage holder proposes; if they also hold finance.approve the
// reversal is applied immediately (self-approval), otherwise it lands draft
// for a checker to approve via PATCH /api/finance/payment-reversals.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;
    const body = await parseJson(request, reverseSchema);

    const canSelfApprove = await hasCapability(context.userId, tenantId, context.role, 'finance.approve');

    const reversal = await createPaymentReversal({
      tenantId,
      paymentId: id,
      reason: body.reason,
      actorId: context.userId,
      canSelfApprove,
    });

    recordAudit(context, 'create', 'payment_reversal', reversal.id, { paymentId: id });

    return NextResponse.json({ success: true, data: reversal }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
