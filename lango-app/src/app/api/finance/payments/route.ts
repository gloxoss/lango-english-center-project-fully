import { and, desc, eq } from 'drizzle-orm';
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
import { centsToMoney } from '@/libs/finance/money';
import { validatePaymentMethod } from '@/libs/finance/payment-methods';
import { moneyInput } from '@/libs/finance/validation';
import { createPayment } from '@/libs/services/payment-create';
import { accountingAdapterExceptions, cashierSessions, invoices, payments, user } from '@/models/Schema';

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
  paymentMethod: z.string().trim().min(1).max(50),
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
    // Security audit P1-A: branch-scoped staff see only their campus
    // (money follows the student's current branch — same rule as the dashboard).
    const branchFilter = context.branchId ? eq(user.branchId, context.branchId) : undefined;
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
    }).from(payments).innerJoin(user, eq(payments.studentId, user.id)).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).where(and(eq(payments.tenantId, tenantId), branchFilter)).orderBy(desc(payments.paymentDate)).limit(pagination.limit).offset(pagination.offset);
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

    // Validate against the tenant's configured payment methods (config-driven,
    // with back-compat to the 4 legacy codes when no config exists yet).
    const methodConfig = await validatePaymentMethod(tenantId, body.paymentMethod);
    if (methodConfig) {
      if ((methodConfig.requiresReference || methodConfig.requiresBank || methodConfig.requiresProof) && !body.referenceId) {
        throw new ApiError(422, 'PAYMENT_REFERENCE_REQUIRED', 'Une référence est requise pour ce moyen de paiement.');
      }
      if (methodConfig.requiresDate && !body.paymentDate) {
        throw new ApiError(422, 'PAYMENT_DATE_REQUIRED', 'Une date de paiement est requise pour ce moyen de paiement.');
      }
    }

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

    const { payment, updatedInvoices, receipt, idempotent, totalPaymentCents } = await createPayment({
      tenantId,
      actorId: context.userId,
      allocations,
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate,
      referenceId: body.referenceId,
      idempotencyKey: body.idempotencyKey,
      note: body.note,
      receivedById: context.userId,
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

    let glPosted = false;
    let postingReason = 'gl_post_skipped';
    try {
      glPosted = Boolean(await tryPostPaymentGLEntry({
        tenantId,
        actorId: context.userId,
        paymentId: payment.id,
        invoiceNumber: updatedInvoices[0]?.invoiceNumber ?? '',
        amount: String(centsToMoney(totalPaymentCents)),
        paymentDate: payment.paymentDate,
      }));
    } catch (error) {
      postingReason = 'gl_post_failed';
      console.error('Payment GL posting failed', { tenantId, paymentId: payment.id, code: (error as { code?: string })?.code ?? 'UNKNOWN' });
    }
    if (!glPosted) {
      try {
        await db.insert(accountingAdapterExceptions).values({
          tenantId,
          sourceModule: 'payment',
          sourceDocumentType: 'payment',
          sourceDocumentId: payment.id,
          version: 1,
          reason: postingReason,
          detail: 'Paiement enregistré mais non passé au grand livre. Vérifiez la période et les comptes 11/34.',
          payload: { amount: centsToMoney(totalPaymentCents), paymentDate: payment.paymentDate },
          status: 'open',
          createdBy: context.userId,
        }).onConflictDoNothing();
      } catch (error) {
        console.error('Payment posting exception could not be recorded', { tenantId, paymentId: payment.id, code: (error as { code?: string })?.code ?? 'UNKNOWN' });
      }
    }

    return NextResponse.json({
      success: true,
      data: { payment, invoices: updatedInvoices, receipt },
      glPosted,
      message: glPosted
        ? `Paiement de ${centsToMoney(totalPaymentCents)} MAD enregistré — reçu ${receipt?.receiptNumber ?? ''}.`
        : `Paiement de ${centsToMoney(totalPaymentCents)} MAD enregistré — reçu ${receipt?.receiptNumber ?? ''}. Écriture comptable en attente : vérifiez les exceptions.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
