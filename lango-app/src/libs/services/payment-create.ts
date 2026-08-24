import { and, eq, inArray, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { createReceipt } from '@/libs/finance/receipt';
import { invoiceEvents, invoices, paymentAllocations, payments } from '@/models/Schema';

export interface PaymentAllocationInput {
  invoiceId: string;
  amount: string; // decimal string, e.g. "1250.00"
}

export interface CreatePaymentInput {
  tenantId: string;
  actorId: string | null;
  allocations: PaymentAllocationInput[];
  paymentMethod: string;
  paymentDate?: string; // YYYY-MM-DD; defaults to today for the receipt when omitted
  referenceId?: string;
  idempotencyKey?: string;
  note?: string;
  receivedById: string | null;
}

export interface CreatePaymentResult {
  payment: typeof payments.$inferSelect;
  updatedInvoices: (typeof invoices.$inferSelect)[];
  receipt: Awaited<ReturnType<typeof createReceipt>> | null;
  idempotent: boolean;
  totalPaymentCents: bigint;
}

// Posts a payment and its allocations against one student's invoices inside a
// single transaction: validates invoices/overpay, inserts the payment +
// payment_allocations, updates invoice balances + invoice_events, and writes the
// receipt. Shared by the manual payments route and the online gateway callback
// so the ledger logic lives in exactly one place.
export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const { tenantId, actorId, allocations, paymentMethod, referenceId, idempotencyKey, receivedById } = input;
  const totalPaymentCents = allocations.reduce((sum, a) => sum + moneyToCents(a.amount), BigInt(0));
  const paymentDate = input.paymentDate ?? new Date().toISOString().slice(0, 10);

  const { payment, updatedInvoices, receipt, idempotent } = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${allocations[0]!.invoiceId}`}, 0))`);

    const invoiceIds = [...new Set(allocations.map((a) => a.invoiceId))];
    const invoiceRows = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, invoiceIds)));
    if (invoiceRows.length !== invoiceIds.length) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Une ou plusieurs factures indiquées n\'existent pas.');
    }
    const byId = new Map(invoiceRows.map((i) => [i.id, i]));
    const studentId = byId.get(allocations[0]!.invoiceId)!.studentId;
    for (const inv of invoiceRows) {
      if (inv.studentId !== studentId) {
        throw new ApiError(422, 'PAYMENT_MIXED_STUDENTS', 'Toutes les factures d\'un même encaissement doivent appartenir au même élève.');
      }
    }

    // Idempotent replay: same tenant + idempotencyKey returns the original
    // payment instead of double-posting. Serialized by the invoice lock, so
    // concurrent duplicates can't both pass this check.
    if (idempotencyKey) {
      const [existing] = await tx.select().from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (existing) {
        return { payment: existing, updatedInvoices: invoiceRows, receipt: null, idempotent: true };
      }
    }

    // Strict overpay policy (user decision): the sum of allocated amounts may
    // never exceed the total outstanding balance — no auto-credit for excess.
    let totalOutstandingCents = BigInt(0);
    for (const inv of invoiceRows) {
      if (inv.status === 'cancelled') {
        throw new ApiError(409, 'INVOICE_CANCELLED', 'Une facture annulée ne peut pas être réglée.');
      }
      totalOutstandingCents += moneyToCents(String(inv.netAmount)) - moneyToCents(String(inv.paidAmount));
    }
    if (totalPaymentCents > totalOutstandingCents) {
      throw new ApiError(409, 'PAYMENT_EXCEEDS_BALANCE', 'Le paiement dépasse le solde total restant des factures.');
    }

    for (const alloc of allocations) {
      const inv = byId.get(alloc.invoiceId)!;
      const allocCents = moneyToCents(alloc.amount);
      const outstandingCents = moneyToCents(String(inv.netAmount)) - moneyToCents(String(inv.paidAmount));
      if (allocCents > outstandingCents) {
        throw new ApiError(409, 'PAYMENT_EXCEEDS_BALANCE', `Le montant alloué à la facture ${inv.invoiceNumber} dépasse son solde restant.`);
      }
    }

    const [newPayment] = await tx.insert(payments).values({
      tenantId,
      invoiceId: allocations[0]!.invoiceId,
      studentId,
      amount: Number(centsToMoney(totalPaymentCents)),
      paymentMethod,
      paymentDate: input.paymentDate ?? undefined,
      referenceId: referenceId || null,
      idempotencyKey: idempotencyKey || null,
      receivedById,
    }).returning();
    if (!newPayment) {
      throw new ApiError(500, 'PAYMENT_INSERT_FAILED', 'Paiement non enregistré.');
    }

    await tx.insert(paymentAllocations).values(allocations.map((a) => ({
      tenantId,
      paymentId: newPayment.id,
      invoiceId: a.invoiceId,
      allocatedAmount: centsToMoney(moneyToCents(a.amount)),
    })));

    const updatedInvoicesList: typeof invoiceRows = [];
    for (const alloc of allocations) {
      const inv = byId.get(alloc.invoiceId)!;
      const allocCents = moneyToCents(alloc.amount);
      const newPaidAmountCents = moneyToCents(String(inv.paidAmount)) + allocCents;
      const newPaidAmount = centsToMoney(newPaidAmountCents);
      const newStatus = newPaidAmountCents === moneyToCents(String(inv.netAmount)) ? 'paid' : 'partial';
      const [updated] = await tx
        .update(invoices)
        .set({ paidAmount: Number(newPaidAmount), status: newStatus, updatedAt: new Date().toISOString() })
        .where(and(eq(invoices.id, inv.id), eq(invoices.tenantId, tenantId)))
        .returning();
      updatedInvoicesList.push(updated ?? inv);
      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: inv.id,
        eventType: 'payment_recorded',
        payload: {
          paymentId: newPayment.id,
          amountCents: allocCents.toString(),
          method: paymentMethod,
          invoiceNumber: inv.invoiceNumber,
        },
        actorUserId: actorId,
      });
    }

    const receipt = await createReceipt(tx, {
      tenantId,
      studentId,
      amountCents: totalPaymentCents,
      paymentDate,
      allocations: allocations.map((a) => {
        const inv = byId.get(a.invoiceId)!;
        return { invoiceId: a.invoiceId, invoiceNumber: inv.invoiceNumber, amount: centsToMoney(moneyToCents(a.amount)) };
      }),
      createdById: actorId,
    });

    return { payment: newPayment, updatedInvoices: updatedInvoicesList, receipt, idempotent: false };
  });

  return { payment, updatedInvoices, receipt, idempotent, totalPaymentCents };
}
