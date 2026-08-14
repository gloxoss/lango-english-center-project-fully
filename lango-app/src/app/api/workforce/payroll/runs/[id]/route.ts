import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { payrollCalculationTraces, payrollPeriods, payrollResultLines, payrollRunLines, payslips, salaryPaymentBatches, salaryPayments, user } from '@/models/Schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.review');
    const { id } = await params;
    const [run] = await db.select().from(payrollPeriods).where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, id)));
    if (!run) throw new ApiError(404, 'PAYROLL_RUN_NOT_FOUND', 'Période de paie introuvable.');
    const lines = await db.select({ line: payrollRunLines, employeeName: user.name, employeeEmail: user.email })
      .from(payrollRunLines).innerJoin(user, and(eq(user.id, payrollRunLines.userId), eq(user.tenantId, tenantId)))
      .where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, id)));
    const resultLines = await db.select().from(payrollResultLines).where(and(eq(payrollResultLines.tenantId, tenantId), eq(payrollResultLines.runId, id)));
    const traces = await db.select().from(payrollCalculationTraces).where(and(eq(payrollCalculationTraces.tenantId, tenantId), eq(payrollCalculationTraces.runId, id)));
    const slips = await db.select().from(payslips).where(and(eq(payslips.tenantId, tenantId), eq(payslips.periodId, id)));
    const batches = await db.select().from(salaryPaymentBatches).where(and(eq(salaryPaymentBatches.tenantId, tenantId), eq(salaryPaymentBatches.runId, id)));
    const firstBatch = batches[0];
    const payments = firstBatch ? await db.select().from(salaryPayments).where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.batchId, firstBatch.id))) : [];
    return NextResponse.json({ success: true, data: { run, lines, resultLines, traces, payslips: slips, batches, payments } });
  } catch (error) { return apiErrorResponse(error); }
}
