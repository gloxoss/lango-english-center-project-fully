import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tryPostPaymentGLEntry } from '@/libs/finance/gl-auto-post';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { moneyInput } from '@/libs/finance/validation';
import { cashierSessions, invoiceEvents, invoices, paymentAllocations, payments, user } from '@/models/Schema';

const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneyInput,
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'check']),
  referenceId: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const pagination = parsePagination(new URL(request.url).searchParams);
    const rows = await db.select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      studentId: payments.studentId,
      studentName: user.name,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paymentDate: payments.paymentDate,
      referenceId: payments.referenceId,
    }).from(payments).innerJoin(user, eq(payments.studentId, user.id)).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).where(eq(payments.tenantId, tenantId)).orderBy(desc(payments.paymentDate)).limit(pagination.limit).offset(pagination.offset);
    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, createPaymentSchema);
    const paymentCents = moneyToCents(body.amount);

    // Cash accountability: a cashier's collected-cash total (accountant/me/cashier)
    // is only ever computed from payments recorded during an open session - a
    // cash payment recorded with no session open would be real money nothing
    // ever reconciles against. Scoped to accountant + cash only: school_admin
    // isn't part of this workflow, and card/transfer/check aren't physical
    // cash a drawer needs to reconcile.
    if (context.role === 'accountant' && body.paymentMethod === 'cash') {
      const [openSession] = await db.select({ id: cashierSessions.id }).from(cashierSessions)
        .where(and(eq(cashierSessions.tenantId, tenantId), eq(cashierSessions.cashierId, context.userId), eq(cashierSessions.status, 'open')))
        .limit(1);
      if (!openSession) {
        throw new ApiError(409, 'NO_OPEN_CASHIER_SESSION', 'Ouvrez votre session de caisse avant d\'encaisser un paiement en espèces.');
      }
    }

    const { payment, updatedInvoice, idempotent } = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${body.invoiceId}`}, 0))`);
      const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
      if (!invoice) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'La facture indiquée n’existe pas.');
      }

      // Idempotent replay: same tenant + idempotencyKey returns the original
      // payment instead of double-posting. Serialized by the invoice lock, so
      // concurrent duplicates can't both pass this check.
      if (body.idempotencyKey) {
        const [existing] = await tx.select().from(payments)
          .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, body.idempotencyKey)))
          .limit(1);
        if (existing) {
          return { payment: existing, updatedInvoice: invoice, idempotent: true };
        }
      }

      const remainingCents = moneyToCents(String(invoice.netAmount)) - moneyToCents(String(invoice.paidAmount));
      if (paymentCents > remainingCents) {
        throw new ApiError(409, 'PAYMENT_EXCEEDS_BALANCE', 'Le paiement dépasse le solde restant de la facture.');
      }

      const [newPayment] = await tx.insert(payments).values({
        tenantId,
        invoiceId: body.invoiceId,
        studentId: invoice.studentId,
        amount: Number(centsToMoney(paymentCents)),
        paymentMethod: body.paymentMethod,
        referenceId: body.referenceId || null,
        idempotencyKey: body.idempotencyKey || null,
        receivedById: context.userId,
      }).returning();
      if (!newPayment) {
        throw new ApiError(500, 'PAYMENT_INSERT_FAILED', 'Paiement non enregistré.');
      }

      await tx.insert(paymentAllocations).values({
        tenantId,
        paymentId: newPayment.id,
        invoiceId: invoice.id,
        allocatedAmount: centsToMoney(paymentCents),
      });

      const newPaidAmount = centsToMoney(moneyToCents(String(invoice.paidAmount)) + paymentCents);
      const newStatus: typeof invoice.status
        = moneyToCents(newPaidAmount) === moneyToCents(String(invoice.netAmount)) ? 'paid' : 'partial';
      const [updated] = await tx.update(invoices).set({
        paidAmount: Number(newPaidAmount),
        status: newStatus,
        updatedAt: new Date().toISOString(),
      }).where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId))).returning();
      if (!updated) {
        throw new ApiError(500, 'INVOICE_UPDATE_FAILED', 'Facture non mise à jour.');
      }

      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: body.invoiceId,
        eventType: 'payment_recorded',
        payload: {
          paymentId: newPayment.id,
          amountCents: paymentCents.toString(),
          method: body.paymentMethod,
        },
        actorUserId: context.userId,
      });

      return { payment: newPayment, updatedInvoice: updated, idempotent: false };
    });

    if (idempotent) {
      return NextResponse.json({
        success: true,
        data: { payment, invoice: updatedInvoice },
        idempotent: true,
        message: 'Paiement déjà enregistré (clé d\'idempotence) — aucune nouvelle écriture.',
      });
    }

    recordAudit(context, 'create', 'payment', payment.id, {
      invoiceId: body.invoiceId,
      amount: centsToMoney(paymentCents),
      newStatus: updatedInvoice.status,
    });

    // GL auto-posting: fail-open — skips silently if CoA not configured or no open fiscal period
    const glEntry = await tryPostPaymentGLEntry({
      tenantId,
      actorId: context.userId,
      paymentId: payment.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      amount: String(centsToMoney(paymentCents)),
      paymentDate: payment.paymentDate,
    });

    return NextResponse.json({
      success: true,
      data: { payment, invoice: updatedInvoice },
      glPosted: glEntry !== null,
      message: `Paiement de ${centsToMoney(paymentCents)} MAD enregistré. Statut facture : ${updatedInvoice.status}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
