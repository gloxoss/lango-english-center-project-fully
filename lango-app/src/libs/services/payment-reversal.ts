import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tryPostPaymentReversalGLEntry } from '@/libs/finance/gl-auto-post';
import { recomputePaidStatus } from '@/libs/finance/invoice-status';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { invoiceEvents, invoices, paymentAllocations, paymentReversals, payments } from '@/models/Schema';

export type CreatePaymentReversalInput = {
  tenantId: string;
  paymentId: string;
  reason: string;
  actorId: string;
  canSelfApprove: boolean;
};

/** Request a payment reversal (maker) — auto-applied when the actor can also approve (checker). Original payment + receipt stay immutable. */
export async function createPaymentReversal(input: CreatePaymentReversalInput) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, input.paymentId), eq(payments.tenantId, input.tenantId)))
    .limit(1);
  if (!payment) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
  }
  if (payment.status !== 'posted') {
    throw new ApiError(409, 'PAYMENT_NOT_REVERSIBLE', 'Ce paiement a déjà été annulé ou remboursé.');
  }

  const now = new Date().toISOString();
  const [reversal] = await db
    .insert(paymentReversals)
    .values({
      tenantId: input.tenantId,
      paymentId: input.paymentId,
      reason: input.reason,
      status: input.canSelfApprove ? 'approved' : 'draft',
      reversedById: input.actorId,
      approvedById: input.canSelfApprove ? input.actorId : null,
      reversedAt: input.canSelfApprove ? now : null,
    })
    .returning();
  if (!reversal) {
    throw new ApiError(500, 'REVERSAL_INSERT_FAILED', 'Annulation non enregistrée.');
  }

  if (input.canSelfApprove) {
    await applyReversal({ tenantId: input.tenantId, reversal, actorId: input.actorId });
  }

  return reversal;
}

export type DecidePaymentReversalInput = {
  tenantId: string;
  id: string;
  decision: 'approved' | 'rejected';
  decidedById: string;
  rejectionReason?: string;
};

/** Approve/reject a draft reversal (checker). Approval applies the reversal immediately. */
export async function decidePaymentReversal(input: DecidePaymentReversalInput) {
  const [existing] = await db
    .select()
    .from(paymentReversals)
    .where(and(eq(paymentReversals.id, input.id), eq(paymentReversals.tenantId, input.tenantId)))
    .limit(1);
  if (!existing) {
    throw new ApiError(404, 'REVERSAL_NOT_FOUND', 'Annulation introuvable.');
  }
  if (existing.status !== 'draft') {
    throw new ApiError(409, 'ALREADY_DECIDED', `Cette annulation est déjà ${existing.status === 'approved' ? 'approuvée' : 'rejetée'}.`);
  }
  if (input.decision === 'rejected' && !input.rejectionReason) {
    throw new ApiError(422, 'REASON_REQUIRED', 'Un motif est requis pour rejeter une annulation.');
  }

  const [updated] = await db
    .update(paymentReversals)
    .set({
      status: input.decision,
      approvedById: input.decidedById,
      rejectionReason: input.decision === 'rejected' ? input.rejectionReason : null,
    })
    .where(and(eq(paymentReversals.id, input.id), eq(paymentReversals.tenantId, input.tenantId)))
    .returning();

  if (input.decision === 'approved' && updated) {
    await applyReversal({ tenantId: input.tenantId, reversal: updated, actorId: input.decidedById });
  }

  return updated;
}

async function applyReversal(input: {
  tenantId: string;
  reversal: { id: string; paymentId: string };
  actorId: string;
}) {
  const { tenantId, reversal, actorId } = input;

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, reversal.paymentId), eq(payments.tenantId, tenantId)))
      .limit(1);
    if (!payment) {
      throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    }
    if (payment.status !== 'posted') {
      throw new ApiError(409, 'PAYMENT_NOT_REVERSIBLE', 'Ce paiement a déjà été annulé ou remboursé.');
    }

    const allocs = await tx
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.paymentId, reversal.paymentId), eq(paymentAllocations.tenantId, tenantId)));

    let touchedInvoiceNumber = '';
    for (const alloc of allocs) {
      const [inv] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, alloc.invoiceId), eq(invoices.tenantId, tenantId)))
        .limit(1);
      if (!inv) continue;
      if (!touchedInvoiceNumber) touchedInvoiceNumber = inv.invoiceNumber;

      const allocCents = moneyToCents(String(alloc.allocatedAmount));
      const reducedCents = moneyToCents(String(inv.paidAmount)) - allocCents;
      const newPaidCents = reducedCents < BigInt(0) ? BigInt(0) : reducedCents;
      const newStatus = recomputePaidStatus(newPaidCents, moneyToCents(String(inv.netAmount)));

      await tx
        .update(invoices)
        .set({ paidAmount: Number(centsToMoney(newPaidCents)), status: newStatus, updatedAt: new Date().toISOString() })
        .where(and(eq(invoices.id, inv.id), eq(invoices.tenantId, tenantId)));

      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: inv.id,
        eventType: 'payment_reversed',
        payload: { paymentId: reversal.paymentId, amountCents: allocCents.toString(), invoiceNumber: inv.invoiceNumber },
        actorUserId: actorId,
      });
    }

    await tx
      .update(payments)
      .set({ status: 'reversed' })
      .where(and(eq(payments.id, reversal.paymentId), eq(payments.tenantId, tenantId)));
    await tx
      .update(paymentReversals)
      .set({ reversedAt: new Date().toISOString() })
      .where(eq(paymentReversals.id, reversal.id));

    return { invoiceNumber: touchedInvoiceNumber, amount: centsToMoney(moneyToCents(String(payment.amount))) };
  });

  await tryPostPaymentReversalGLEntry({
    tenantId,
    actorId,
    reversalId: reversal.id,
    invoiceNumber: result.invoiceNumber,
    amount: result.amount,
    reversalDate: new Date().toISOString(),
  });
}
