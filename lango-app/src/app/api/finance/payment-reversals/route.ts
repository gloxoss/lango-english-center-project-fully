import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { decidePaymentReversal } from '@/libs/services/payment-reversal';
import { paymentReversals, payments, user } from '@/models/Schema';

const decideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(
  body => body.decision !== 'rejected' || !!body.rejectionReason,
  { message: 'Un motif est requis pour rejeter une annulation.', path: ['rejectionReason'] },
);

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const records = await db
      .select({
        id: paymentReversals.id,
        paymentId: paymentReversals.paymentId,
        reason: paymentReversals.reason,
        status: paymentReversals.status,
        reversedById: paymentReversals.reversedById,
        approvedById: paymentReversals.approvedById,
        rejectionReason: paymentReversals.rejectionReason,
        reversedAt: paymentReversals.reversedAt,
        createdAt: paymentReversals.createdAt,
        amount: payments.amount,
        studentName: user.name,
      })
      .from(paymentReversals)
      .innerJoin(payments, eq(paymentReversals.paymentId, payments.id))
      .innerJoin(user, eq(payments.studentId, user.id))
      .where(eq(paymentReversals.tenantId, tenantId))
      .orderBy(desc(paymentReversals.createdAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.approve');
    const body = await parseJson(req, decideSchema);

    const updated = await decidePaymentReversal({
      tenantId,
      id: body.id,
      decision: body.decision,
      decidedById: context.userId,
      rejectionReason: body.rejectionReason,
    });

    recordAudit(context, 'update', 'payment_reversal', updated!.id, { decision: body.decision });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
