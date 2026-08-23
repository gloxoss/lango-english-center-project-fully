import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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
import { createReceipt } from '@/libs/finance/receipt';
import { moneyInput } from '@/libs/finance/validation';
import { cashierSessions, invoiceEvents, invoices, paymentAllocations, payments, user } from '@/models/Schema';

const allocationItemSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneyInput,
}).strict();

// Accepts either the modern multi-invoice shape ({ allocations: [...] }) or the
// legacy single-invoice shape ({ invoiceId, amount }) — the legacy caller (e.g.
// the collection desk before Phase D) is normalized to a one-item allocation.
const createPaymentSchema = z.object({
  allocations: z.array(allocationItemSchema).min(1).max(50).optional(),
  invoiceId: z.string().uuid().optional(),
  amount: moneyInput.optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'check']),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu').optional(),
  referenceId: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().max(500).optional(),
}).strict().superRefine((data, ctx) => {
  const hasAllocations = (data.allocations?.length ?? 0) > 0;
  const hasLegacy = Boolean(data.invoiceId && data.amount);
  if (!hasAllocations && !hasLegacy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fournissez allocations[] ou invoiceId+amount.' });
  }
  if (hasAllocations && hasLegacy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fournissez soit allocations[] soit invoiceId+amount, pas les deux.' });
  }
});

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
      status: payments.status,
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

    // Normalize legacy single-invoice shape into the multi-invoice allocations form.
    const allocations = body.allocations
      ?? [{ invoiceId: body.invoiceId!, amount: body.amount! }];
    const totalPaymentCents = allocations.reduce((sum, a) => sum + moneyToCents(a.amount), BigInt(0));
    const paymentDate = body.paymentDate ?? new Date().toISOString().slice(0, 10);

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

    const { payment, updatedInvoices, receipt, idempotent } = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${allocations[0]!.invoiceId}`}, 0))`);

      const invoiceIds = [...new Set(allocations.map(a => a.invoiceId))];
      const invoiceRows = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, invoiceIds)));
      if (invoiceRows.length !== invoiceIds.length) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Une ou plusieurs factures indiquées n\'existent pas.');
      }
      const byId = new Map(invoiceRows.map(i => [i.id, i]));
      const studentId = byId.get(allocations[0]!.invoiceId)!.studentId;
      for (const inv of invoiceRows) {
        if (inv.studentId !== studentId) {
          throw new ApiError(422, 'PAYMENT_MIXED_STUDENTS', 'Toutes les factures d\'un même encaissement doivent appartenir au même élève.');
        }
      }

      // Idempotent replay: same tenant + idempotencyKey returns the original
      // payment instead of double-posting. Serialized by the invoice lock, so
      // concurrent duplicates can't both pass this check.
      if (body.idempotencyKey) {
        const [existing] = await tx.select().from(payments)
          .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, body.idempotencyKey)))
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
        paymentMethod: body.paymentMethod,
        paymentDate: body.paymentDate ?? undefined,
        referenceId: body.referenceId || null,
        idempotencyKey: body.idempotencyKey || null,
        receivedById: context.userId,
      }).returning();
      if (!newPayment) {
        throw new ApiError(500, 'PAYMENT_INSERT_FAILED', 'Paiement non enregistré.');
      }

      await tx.insert(paymentAllocations).values(allocations.map(a => ({
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
            method: body.paymentMethod,
            invoiceNumber: inv.invoiceNumber,
          },
          actorUserId: context.userId,
        });
      }

      const receipt = await createReceipt(tx, {
        tenantId,
        studentId,
        amountCents: totalPaymentCents,
        paymentDate,
        allocations: allocations.map(a => {
          const inv = byId.get(a.invoiceId)!;
          return { invoiceId: a.invoiceId, invoiceNumber: inv.invoiceNumber, amount: centsToMoney(moneyToCents(a.amount)) };
        }),
        createdById: context.userId,
      });

      return { payment: newPayment, updatedInvoices: updatedInvoicesList, receipt, idempotent: false };
    });

    if (idempotent) {
      return NextResponse.json({
        success: true,
        data: { payment, invoices: updatedInvoices, receipt },
        idempotent: true,
        message: 'Paiement déjà enregistré (clé d\'idempotence) — aucune nouvelle écriture.',
      });
    }

    recordAudit(context, 'create', 'payment', payment.id, {
      invoiceIds: allocations.map(a => a.invoiceId),
      amount: centsToMoney(totalPaymentCents),
      receiptNumber: receipt?.receiptNumber,
      statuses: updatedInvoices.map(i => i.status),
    });

    // GL auto-posting: fail-open — skips silently if CoA not configured or no open fiscal period
    const glEntry = await tryPostPaymentGLEntry({
      tenantId,
      actorId: context.userId,
      paymentId: payment.id,
      invoiceNumber: updatedInvoices[0]?.invoiceNumber ?? '',
      amount: String(centsToMoney(totalPaymentCents)),
      paymentDate: payment.paymentDate,
    });

    return NextResponse.json({
      success: true,
      data: { payment, invoices: updatedInvoices, receipt },
      glPosted: glEntry !== null,
      message: `Paiement de ${centsToMoney(totalPaymentCents)} MAD enregistré — reçu ${receipt?.receiptNumber ?? ''}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
