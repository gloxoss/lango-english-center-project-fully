import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tryPostRefundGLEntry } from '@/libs/finance/gl-auto-post';
import { recomputePaidStatus } from '@/libs/finance/invoice-status';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { invoiceEvents, invoices, paymentAllocations, payments, refunds } from '@/models/Schema';

export type DecideRefundInput = {
  tenantId: string;
  id: string;
  decision: 'approved' | 'rejected';
  decidedById: string;
  rejectionReason?: string;
};

export type ApprovedRefund = {
  id: string;
  paymentId: string | null;
  studentId: string;
  amount: string;
  refundNumber: string;
  decidedAt: string | null;
};

/** Same shape as decideCreditNote - one state transition, shared by the Refunds page and the accountant approvals queue. */
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
    await applyApprovedRefund({
      tenantId: input.tenantId,
      actorId: input.decidedById,
      refund: updated,
    });
  }

  return updated;
}

/**
 * Apply an approved refund's ledger linkage: mark the linked payment refunded,
 * restore invoice paidAmount FIFO across that payment's allocations, record
 * invoice events, then post the refund GL entry (DR AR / CR Cash). Fail-open GL,
 * immutable original rows. (Migration 0042's trigger already caps a refund at
 * the original payment amount and requires a linked payment, so there is no
 * over-refund leftover to park as a student credit.)
 */
export async function applyApprovedRefund(input: {
  tenantId: string;
  actorId: string;
  refund: ApprovedRefund;
}) {
  const { tenantId, actorId, refund } = input;
  const refundCents = moneyToCents(refund.amount);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, refund.paymentId!), eq(payments.tenantId, tenantId)))
      .limit(1);
    if (!payment) {
      throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    }
    if (payment.status !== 'posted') {
      throw new ApiError(409, 'PAYMENT_NOT_REFUNDABLE', 'Ce paiement a déjà été annulé ou remboursé.');
    }

    const allocs = await tx
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.paymentId, refund.paymentId!), eq(paymentAllocations.tenantId, tenantId)));

    let remaining = refundCents;
    for (const alloc of allocs) {
      if (remaining <= BigInt(0)) break;
      const [inv] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, alloc.invoiceId), eq(invoices.tenantId, tenantId)))
        .limit(1);
      if (!inv) continue;

      const allocCents = moneyToCents(String(alloc.allocatedAmount));
      const reduceCents = remaining < allocCents ? remaining : allocCents;
      const reducedCents = moneyToCents(String(inv.paidAmount)) - reduceCents;
      const newPaidCents = reducedCents < BigInt(0) ? BigInt(0) : reducedCents;
      const newStatus = recomputePaidStatus(newPaidCents, moneyToCents(String(inv.netAmount)));

      await tx
        .update(invoices)
        .set({ paidAmount: Number(centsToMoney(newPaidCents)), status: newStatus, updatedAt: now })
        .where(and(eq(invoices.id, inv.id), eq(invoices.tenantId, tenantId)));

      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: inv.id,
        eventType: 'refund_recorded',
        payload: { refundId: refund.id, amountCents: reduceCents.toString(), refundNumber: refund.refundNumber, invoiceNumber: inv.invoiceNumber },
        actorUserId: actorId,
      });

      remaining -= reduceCents;
    }

    await tx
      .update(payments)
      .set({ status: 'refunded' })
      .where(and(eq(payments.id, refund.paymentId!), eq(payments.tenantId, tenantId)));
  });

  return await tryPostRefundGLEntry({
    tenantId,
    actorId,
    refundId: refund.id,
    refundNumber: refund.refundNumber,
    amount: refund.amount,
    refundDate: refund.decidedAt ?? now,
  });
}
