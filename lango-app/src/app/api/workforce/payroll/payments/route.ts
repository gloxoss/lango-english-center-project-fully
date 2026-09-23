import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeProfiles, payrollPeriods, payrollRunLines, salaryPaymentBatches, salaryPayments } from '@/models/Schema';
import { isBankPaymentMethod, missingBankRibCount } from '@/features/workforce/services/payment-bank';

const createSchema = z.object({ runId: z.string().uuid(), method: z.enum(['bank', 'bank_transfer', 'cash', 'cheque']) }).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.payment.prepare');
    const batches = await db.select().from(salaryPaymentBatches).where(eq(salaryPaymentBatches.tenantId, tenantId)).orderBy(desc(salaryPaymentBatches.createdAt));
    const bankBatchIds = batches.filter(batch => isBankPaymentMethod(batch.method)).map(batch => batch.id);
    const missingRows = bankBatchIds.length ? await db.select({
      batchId: salaryPayments.batchId,
      count: sql<number>`count(*) filter (where ${employeeProfiles.bankRib} is null or btrim(${employeeProfiles.bankRib}) = '')`,
    }).from(salaryPayments)
      .leftJoin(employeeProfiles, and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, salaryPayments.userId)))
      .where(and(eq(salaryPayments.tenantId, tenantId), inArray(salaryPayments.batchId, bankBatchIds)))
      .groupBy(salaryPayments.batchId) : [];
    const missingByBatch = new Map(missingRows.map(row => [row.batchId, Number(row.count)]));
    return NextResponse.json({ success: true, data: batches.map(batch => ({ ...batch, bankRibMissingCount: missingByBatch.get(batch.id) ?? 0 })) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.payment.prepare');
    const body = await parseJson(request, createSchema);
    const batch = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`payroll:payment:${tenantId}:${body.runId}`}, 0))`);
      const [run] = await tx.select().from(payrollPeriods).where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, body.runId))).for('update');
      if (!run || run.status !== 'posted') throw new ApiError(409, 'PAYROLL_RUN_NOT_PAYABLE', 'Seule une paie comptabilisée peut être mise en paiement.');
      const lines = await tx.select().from(payrollRunLines).where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, body.runId)));
      if (!lines.length) throw new ApiError(409, 'PAYROLL_NO_LINES', 'Aucune ligne de paie à payer.');
      if (isBankPaymentMethod(body.method)) {
        const bankRecipients = await tx.select({ bankRib: employeeProfiles.bankRib })
          .from(payrollRunLines)
          .leftJoin(employeeProfiles, and(
            eq(employeeProfiles.tenantId, tenantId),
            eq(employeeProfiles.userId, payrollRunLines.userId),
          ))
          .where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, body.runId)));
        const missingCount = missingBankRibCount(bankRecipients);
        if (missingCount > 0) {
          throw new ApiError(409, 'PAYROLL_BANK_RIB_MISSING', `Lot bancaire bloqué : ${missingCount} salarié(s) n’ont pas de RIB enregistré.`);
        }
      }
      const total = lines.reduce((sum, line) => sum + Math.round(Number(line.netPayable ?? line.netSalary) * 100), 0);
      const [created] = await tx.insert(salaryPaymentBatches).values({ tenantId, runId: body.runId, method: body.method, status: 'prepared', totalAmount: (total / 100).toFixed(2), preparedById: ctx.userId }).returning();
      if (!created) throw new ApiError(500, 'PAYMENT_BATCH_FAILED', 'Impossible de créer le lot.');
      await tx.insert(salaryPayments).values(lines.map(line => ({ tenantId, batchId: created.id, runLineId: line.id, userId: line.userId, amount: line.netPayable ?? line.netSalary, status: 'pending' })));
      await tx.update(payrollPeriods).set({ paymentBatchId: created.id }).where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, body.runId)));
      return created;
    });
    recordAudit(ctx, 'create', 'payroll_payment_batch', batch!.id, { runId: body.runId, method: body.method });
    return NextResponse.json({ success: true, data: batch }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
