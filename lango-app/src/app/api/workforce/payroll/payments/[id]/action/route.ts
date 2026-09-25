import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isBankPaymentMethod, missingBankRibCount } from '@/features/workforce/services/payment-bank';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeProfiles, payrollPeriods, salaryPaymentBatches, salaryPayments } from '@/models/Schema';

const schema = z.object({ action: z.enum(['approve', 'reconcile', 'fail', 'reverse']), reference: z.string().trim().max(120).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId); const body = await parseJson(request, schema);
    await requireCapability(ctx, body.action === 'approve' ? 'payroll.payment.approve' : 'payroll.payment.reconcile');
    const { id } = await params;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`payroll:batch:${tenantId}:${id}`}, 0))`);
      const [batch] = await tx.select().from(salaryPaymentBatches).where(and(eq(salaryPaymentBatches.tenantId, tenantId), eq(salaryPaymentBatches.id, id))).for('update');
      if (!batch) {
        throw new ApiError(404, 'PAYMENT_BATCH_NOT_FOUND', 'Lot de paiement introuvable.');
      }
      if (isBankPaymentMethod(batch.method) && (body.action === 'approve' || body.action === 'reconcile')) {
        const recipients = await tx.select({ bankRib: employeeProfiles.bankRib })
          .from(salaryPayments)
          .leftJoin(employeeProfiles, and(
            eq(employeeProfiles.tenantId, tenantId),
            eq(employeeProfiles.userId, salaryPayments.userId),
          ))
          .where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.batchId, id)));
        if (!recipients.length) {
          throw new ApiError(409, 'PAYMENT_BATCH_EMPTY', 'Le lot ne contient aucun paiement.');
        }
        const missingCount = missingBankRibCount(recipients);
        if (missingCount) {
          throw new ApiError(409, 'PAYROLL_BANK_RIB_MISSING', `Lot bancaire bloqué : ${missingCount} salarié(s) n’ont pas de RIB enregistré.`);
        }
      }
      if (body.action === 'approve') {
        if (batch.status !== 'prepared') {
          throw new ApiError(409, 'PAYMENT_INVALID_TRANSITION', 'Le lot n’est pas prêt à être approuvé.');
        }
        if (batch.preparedById === ctx.userId) {
          throw new ApiError(403, 'PAYMENT_SELF_APPROVAL', 'Le préparateur ne peut pas approuver son propre lot.');
        }
        return (await tx.update(salaryPaymentBatches).set({ status: 'approved', approvedById: ctx.userId, approvedAt: new Date().toISOString() }).where(eq(salaryPaymentBatches.id, id)).returning())[0];
      }
      if (body.action === 'reconcile') {
        if (batch.status !== 'approved' && batch.status !== 'exported' && batch.status !== 'submitted') {
          throw new ApiError(409, 'PAYMENT_INVALID_TRANSITION', 'Le lot doit être approuvé.');
        }
        const now = new Date().toISOString();
        await tx.update(salaryPayments).set({ status: 'paid', bankReference: body.reference ?? null, paidById: ctx.userId, paidAt: now }).where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.batchId, id), eq(salaryPayments.status, 'pending')));
        const updated = (await tx.update(salaryPaymentBatches).set({ status: 'paid', reconciliationStatus: 'reconciled', reconciledById: ctx.userId, reconciledAt: now }).where(eq(salaryPaymentBatches.id, id)).returning())[0];
        await tx.update(payrollPeriods).set({ status: 'paid' }).where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, batch.runId), eq(payrollPeriods.status, 'posted')));
        return updated;
      }
      if (body.action === 'fail') {
        // Used to accept any status, so a paid and reconciled batch could be
        // flipped to failed while its payments still said paid.
        if (!['prepared', 'approved', 'exported', 'submitted'].includes(batch.status)) {
          throw new ApiError(409, 'PAYMENT_INVALID_TRANSITION', 'Seul un lot non payé peut être marqué en échec.');
        }
        // Failed rows no longer count as live payments, so a new batch can pay these lines (0159).
        await tx.update(salaryPayments).set({ status: 'failed' }).where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.batchId, id), eq(salaryPayments.status, 'pending')));
        return (await tx.update(salaryPaymentBatches).set({ status: 'failed' }).where(eq(salaryPaymentBatches.id, id)).returning())[0];
      }
      if (batch.status !== 'paid') {
        throw new ApiError(409, 'PAYMENT_INVALID_TRANSITION', 'Seul un lot payé peut être contrepassé.');
      }
      await tx.update(salaryPayments).set({ status: 'reversed' }).where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.batchId, id)));
      // The salaries are owed again: reopen the run so a new batch can be prepared.
      await tx.update(payrollPeriods).set({ status: 'posted' }).where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, batch.runId), eq(payrollPeriods.status, 'paid')));
      return (await tx.update(salaryPaymentBatches).set({ status: 'reversed', reversedById: ctx.userId, reversedAt: new Date().toISOString() }).where(eq(salaryPaymentBatches.id, id)).returning())[0];
    });
    recordAudit(ctx, 'update', 'payroll_payment_batch_action', id, { action: body.action, reference: body.reference ?? null });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
