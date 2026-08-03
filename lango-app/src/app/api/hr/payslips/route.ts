import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';

import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines, payslips, user } from '@/models/Schema';

// GET /api/hr/payslips
// - Employee: sees only own payslips
// - hr.manage role: sees all payslips for the tenant

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);

    const rows = await db
      .select({
        id: payslips.id,
        periodId: payslips.periodId,
        userId: payslips.userId,
        issuedAt: payslips.issuedAt,
        employeeName: user.name,
        year: payrollPeriods.year,
        month: payrollPeriods.month,
        grossSalary: payrollRunLines.grossSalary,
        netSalary: payrollRunLines.netSalary,
        cnssEmployee: payrollRunLines.cnssEmployee,
        amoEmployee: payrollRunLines.amoEmployee,
        irTax: payrollRunLines.irTax,
      })
      .from(payslips)
      .innerJoin(user, eq(payslips.userId, user.id))
      .innerJoin(payrollPeriods, eq(payslips.periodId, payrollPeriods.id))
      .innerJoin(payrollRunLines, eq(payslips.runLineId, payrollRunLines.id))
      .where(
        and(
          eq(payslips.tenantId, tenantId),
          // Non-HR roles can only see their own payslips
          isHrAdmin ? undefined : eq(payslips.userId, ctx.userId),
        ),
      );

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
