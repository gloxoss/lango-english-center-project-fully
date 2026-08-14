import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines, payslips, user } from '@/models/Schema';
import { renderPayslipHtml } from '@/features/hr/services/payslips';

// GET /api/hr/payslips/[id] — Fetch single payslip (with auth guard)
// GET /api/hr/payslips/[id]/pdf — Render bulletin de paie as HTML

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    const { id } = await params;

    const [row] = await db
      .select({
        id: payslips.id,
        userId: payslips.userId,
        issuedAt: payslips.issuedAt,
        employeeName: user.name,
        employeeEmail: user.email,
        year: payrollPeriods.year,
        month: payrollPeriods.month,
        grossSalary: payrollRunLines.grossSalary,
        netSalary: payrollRunLines.netSalary,
        cnssEmployee: payrollRunLines.cnssEmployee,
        amoEmployee: payrollRunLines.amoEmployee,
        irTax: payrollRunLines.irTax,
        cnssEmployer: payrollRunLines.cnssEmployer,
        amoEmployer: payrollRunLines.amoEmployer,
        totalEmployerCost: payrollRunLines.totalEmployerCost,
        snapshot: payrollRunLines.calculationSnapshot,
      })
      .from(payslips)
      .innerJoin(user, eq(payslips.userId, user.id))
      .innerJoin(payrollPeriods, eq(payslips.periodId, payrollPeriods.id))
      .innerJoin(payrollRunLines, eq(payslips.runLineId, payrollRunLines.id))
      .where(and(eq(payslips.id, id), eq(payslips.tenantId, tenantId)))
      .limit(1);

    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Bulletin de paie introuvable.');
    }

    // Ownership check: non-HR staff can only view their own payslip
    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);
    if (!isHrAdmin && row.userId !== ctx.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé à ce bulletin de paie.');
    }

    // Check if request wants HTML (pdf view)
    const url = new URL(request.url);
    if (url.pathname.endsWith('/pdf')) {
      return new Response(renderPayslipHtml(row), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
