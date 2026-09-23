import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { tryPostPaymentGLEntry, tryPostPaymentReversalGLEntry, tryPostRefundGLEntry } from '@/libs/finance/gl-auto-post';
import { accountingAdapterExceptions, fiscalPeriods, invoices, journalEntries, paymentReversals, payments, refunds, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'accounting.statement.read');
    const [period, unposted, unpostedReversals, unpostedRefunds] = await Promise.all([
      db.select({ id: fiscalPeriods.id }).from(fiscalPeriods)
        .where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.status, 'open'))).limit(1),
      db.select({
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
      })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.sourceModule, 'payment'),
          eq(journalEntries.sourceId, payments.id),
          eq(journalEntries.status, 'posted'),
        ))
        .where(and(
          eq(payments.tenantId, tenantId),
          inArray(payments.status, ['posted', 'reversed', 'refunded']),
          isNull(journalEntries.id),
          context.branchId ? eq(user.branchId, context.branchId) : undefined,
        )),
      db.select({ count: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(paymentReversals)
        .innerJoin(payments, and(eq(payments.id, paymentReversals.paymentId), eq(payments.tenantId, tenantId)))
        .innerJoin(user, and(eq(user.id, payments.studentId), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'payment_reversal'),
          eq(journalEntries.sourceId, paymentReversals.id), eq(journalEntries.status, 'posted')))
        .where(and(eq(paymentReversals.tenantId, tenantId), eq(paymentReversals.status, 'approved'),
          isNull(journalEntries.id), context.branchId ? eq(user.branchId, context.branchId) : undefined)),
      db.select({ count: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::float` })
        .from(refunds)
        .innerJoin(user, and(eq(user.id, refunds.studentId), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'refund'),
          eq(journalEntries.sourceId, refunds.id), eq(journalEntries.status, 'posted')))
        .where(and(eq(refunds.tenantId, tenantId), eq(refunds.status, 'approved'),
          isNull(journalEntries.id), context.branchId ? eq(user.branchId, context.branchId) : undefined)),
    ]);
    return NextResponse.json({ success: true, data: {
      openFiscalPeriod: period.length > 0,
      unpostedPaymentsCount: unposted[0]?.count ?? 0,
      unpostedPaymentsAmount: unposted[0]?.amount ?? 0,
      unpostedAdjustmentsCount: (unpostedReversals[0]?.count ?? 0) + (unpostedRefunds[0]?.count ?? 0),
      unpostedAdjustmentsAmount: (unpostedReversals[0]?.amount ?? 0) + (unpostedRefunds[0]?.amount ?? 0),
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// A bounded, repeatable repair pass for payments collected before GL setup.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'accounting.voucher.post');
    const [period] = await db.select({ id: fiscalPeriods.id }).from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.status, 'open'))).limit(1);
    if (!period) throw new ApiError(409, 'NO_OPEN_FISCAL_PERIOD', 'Ouvrez une période comptable avant de reprendre les paiements.');

    const pending = await db.select({
      id: payments.id,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      invoiceNumber: invoices.invoiceNumber,
    }).from(payments)
      .innerJoin(invoices, and(eq(invoices.id, payments.invoiceId), eq(invoices.tenantId, tenantId)))
      .innerJoin(user, and(eq(user.id, payments.studentId), eq(user.tenantId, tenantId)))
      .leftJoin(journalEntries, and(
        eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'payment'),
        eq(journalEntries.sourceId, payments.id), eq(journalEntries.status, 'posted'),
      ))
      .where(and(
        eq(payments.tenantId, tenantId), inArray(payments.status, ['posted', 'reversed', 'refunded']), isNull(journalEntries.id),
        context.branchId ? eq(user.branchId, context.branchId) : undefined,
      )).orderBy(payments.paymentDate, payments.id).limit(50);

    let posted = 0;
    let blocked = 0;
    for (const payment of pending) {
      let reason = 'gl_post_skipped';
      try {
        const result = await tryPostPaymentGLEntry({
          tenantId, actorId: context.userId, paymentId: payment.id,
          invoiceNumber: payment.invoiceNumber, amount: String(payment.amount), paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
        });
        if (result) {
          posted++;
          await db.update(accountingAdapterExceptions).set({
            status: 'resolved', resolvedBy: context.userId, resolvedAt: new Date().toISOString(),
            resolutionNote: `Écriture ${result.entry.entryNumber} créée lors de la reprise.`,
          }).where(and(
            eq(accountingAdapterExceptions.tenantId, tenantId),
            eq(accountingAdapterExceptions.sourceModule, 'payment'),
            eq(accountingAdapterExceptions.sourceDocumentId, payment.id),
          ));
          continue;
        }
      } catch (error) {
        reason = 'gl_post_failed';
        console.error('Payment GL backfill failed', { tenantId, paymentId: payment.id, code: (error as { code?: string })?.code ?? 'UNKNOWN' });
      }
      blocked++;
      await db.insert(accountingAdapterExceptions).values({
        tenantId, sourceModule: 'payment', sourceDocumentType: 'payment', sourceDocumentId: payment.id,
        version: 1, reason, detail: 'Paiement non passé au grand livre. Vérifiez la période et les comptes 11/34.',
        payload: { amount: payment.amount, paymentDate: payment.paymentDate },
        status: 'open', createdBy: context.userId,
      }).onConflictDoNothing();
    }

    const [reversalRows, refundRows] = await Promise.all([
      db.select({ id: paymentReversals.id, amount: payments.amount, paymentMethod: payments.paymentMethod,
        date: sql<string>`coalesce(${paymentReversals.reversedAt}, ${paymentReversals.createdAt})`,
        number: invoices.invoiceNumber })
        .from(paymentReversals)
        .innerJoin(payments, and(eq(payments.id, paymentReversals.paymentId), eq(payments.tenantId, tenantId)))
        .innerJoin(invoices, and(eq(invoices.id, payments.invoiceId), eq(invoices.tenantId, tenantId)))
        .innerJoin(user, and(eq(user.id, payments.studentId), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'payment_reversal'),
          eq(journalEntries.sourceId, paymentReversals.id), eq(journalEntries.status, 'posted')))
        .where(and(eq(paymentReversals.tenantId, tenantId), eq(paymentReversals.status, 'approved'),
          isNull(journalEntries.id), context.branchId ? eq(user.branchId, context.branchId) : undefined))
        .orderBy(paymentReversals.createdAt, paymentReversals.id).limit(50),
      db.select({ id: refunds.id, amount: refunds.amount, paymentMethod: refunds.refundMethod,
        date: sql<string>`coalesce(${refunds.decidedAt}, ${refunds.createdAt})`,
        number: refunds.refundNumber })
        .from(refunds)
        .innerJoin(user, and(eq(user.id, refunds.studentId), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'refund'),
          eq(journalEntries.sourceId, refunds.id), eq(journalEntries.status, 'posted')))
        .where(and(eq(refunds.tenantId, tenantId), eq(refunds.status, 'approved'),
          isNull(journalEntries.id), context.branchId ? eq(user.branchId, context.branchId) : undefined))
        .orderBy(refunds.createdAt, refunds.id).limit(50),
    ]);
    const adjustments = [
      ...reversalRows.map(row => ({ ...row, module: 'payment_reversal' as const })),
      ...refundRows.map(row => ({ ...row, module: 'refund' as const })),
    ].slice(0, 50);
    for (const document of adjustments) {
      let reason = 'gl_post_skipped';
      try {
        const result = document.module === 'refund'
          ? await tryPostRefundGLEntry({ tenantId, actorId: context.userId, refundId: document.id,
            refundNumber: document.number, amount: String(document.amount), refundDate: document.date,
            refundMethod: document.paymentMethod })
          : await tryPostPaymentReversalGLEntry({ tenantId, actorId: context.userId, reversalId: document.id,
            invoiceNumber: document.number, amount: String(document.amount), reversalDate: document.date,
            paymentMethod: document.paymentMethod });
        if (result) {
          posted++;
          await db.update(accountingAdapterExceptions).set({
            status: 'resolved', resolvedBy: context.userId, resolvedAt: new Date().toISOString(),
            resolutionNote: `Écriture ${result.entry.entryNumber} créée lors de la reprise.`,
          }).where(and(eq(accountingAdapterExceptions.tenantId, tenantId),
            eq(accountingAdapterExceptions.sourceModule, document.module),
            eq(accountingAdapterExceptions.sourceDocumentId, document.id)));
          continue;
        }
      } catch (error) {
        reason = 'gl_post_failed';
        console.error('GL adjustment backfill failed', { tenantId, sourceModule: document.module,
          sourceDocumentId: document.id, code: (error as { code?: string })?.code ?? 'UNKNOWN' });
      }
      blocked++;
      await db.insert(accountingAdapterExceptions).values({
        tenantId, sourceModule: document.module, sourceDocumentType: document.module,
        sourceDocumentId: document.id, version: 1, reason,
        detail: 'Opération financière non passée au grand livre. Vérifiez la période et les comptes 11/34.',
        payload: { amount: document.amount, date: document.date }, status: 'open', createdBy: context.userId,
      }).onConflictDoNothing();
    }
    return NextResponse.json({ success: true, data: {
      attempted: pending.length + adjustments.length, posted, blocked, batchLimit: 100,
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
