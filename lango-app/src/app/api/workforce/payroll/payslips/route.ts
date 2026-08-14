import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines, payslips, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.sensitive.read');
    const rows = await db.select({ id: payslips.id, number: payslips.payslipNumber, status: payslips.status, issuedAt: payslips.issuedAt, employeeName: user.name, employeeEmail: user.email, year: payrollPeriods.year, month: payrollPeriods.month, gross: payrollRunLines.grossSalary, net: payrollRunLines.netPayable })
      .from(payslips)
      .innerJoin(payrollPeriods, and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, payslips.periodId)))
      .innerJoin(payrollRunLines, and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.id, payslips.runLineId)))
      .innerJoin(user, and(eq(user.tenantId, tenantId), eq(user.id, payslips.userId)))
      .where(eq(payslips.tenantId, tenantId)).orderBy(desc(payslips.issuedAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}
