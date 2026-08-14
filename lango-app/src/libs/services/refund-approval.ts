import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tryPostRefundGLEntry } from '@/libs/finance/gl-auto-post';
import { refunds } from '@/models/Schema';

export type DecideRefundInput = {
  tenantId: string;
  id: string;
  decision: 'approved' | 'rejected';
  decidedById: string;
  rejectionReason?: string;
};

/** Same shape as decideCreditNote - one state transition, shared by the Refunds page and the accountant approvals queue. GL entry posts only here, on approval, not at request time. */
export async function decideRefund(input: DecideRefundInput) {
  const [existing] = await db.select().from(refunds)
    .where(and(eq(refunds.id, input.id), eq(refunds.tenantId, input.tenantId))).limit(1);
  if (!existing) {
    throw new ApiError(404, 'REFUND_NOT_FOUND', 'Remboursement introuvable.');
  }
  if (existing.status !== 'pending') {
    throw new ApiError(409, 'ALREADY_DECIDED', `Ce remboursement est déjà ${existing.status === 'approved' ? 'approuvé' : 'rejeté'}.`);
  }
  if (input.decision === 'rejected' && !input.rejectionReason) {
    throw new ApiError(422, 'REASON_REQUIRED', 'Un motif est requis pour rejeter un remboursement.');
  }

  const [updated] = await db.update(refunds).set({
    status: input.decision,
    decidedById: input.decidedById,
    decidedAt: new Date().toISOString(),
    rejectionReason: input.decision === 'rejected' ? input.rejectionReason : null,
  }).where(and(eq(refunds.id, input.id), eq(refunds.tenantId, input.tenantId))).returning();

  if (input.decision === 'approved' && updated) {
    await tryPostRefundGLEntry({
      tenantId: input.tenantId,
      actorId: input.decidedById,
      refundId: updated.id,
      refundNumber: updated.refundNumber,
      amount: updated.amount,
      refundDate: updated.decidedAt!,
    });
  }

  return updated;
}
