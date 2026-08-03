import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { calculatePayslipLine } from '@/libs/services/payroll-engine';
import { employeeSalaryAssignments, payrollPeriods, payrollRunLines, user } from '@/models/Schema';

// POST /api/hr/payroll/periods/[id]/calculate
// Computes gross-to-net for every active employee with a salary assignment.
// Upserts into payroll_run_lines. Safe to run multiple times (idempotent).

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const { id: periodId } = await params;

    // Load and validate period
    const [period] = await db
      .select()
      .from(payrollPeriods)
      .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)))
      .limit(1);

    if (!period) {
      throw new ApiError(404, 'NOT_FOUND', 'Période de paie introuvable.');
    }
    if (period.status === 'locked') {
      throw new ApiError(409, 'PERIOD_LOCKED', 'Cette période est verrouillée et ne peut plus être modifiée.');
    }

    // Get all active employees with a salary assignment for this tenant
    // Take the most recent assignment per employee (effectiveDate DESC)
    const assignments = await db
      .select({
        userId: employeeSalaryAssignments.userId,
        baseSalary: employeeSalaryAssignments.baseSalary,
      })
      .from(employeeSalaryAssignments)
      .innerJoin(user, eq(employeeSalaryAssignments.userId, user.id))
      .where(
        and(
          eq(employeeSalaryAssignments.tenantId, tenantId),
          eq(user.userStatus, 'active'),
          eq(user.tenantId, tenantId),
        ),
      )
      .orderBy(desc(employeeSalaryAssignments.effectiveDate));

    if (assignments.length === 0) {
      throw new ApiError(422, 'NO_EMPLOYEES', 'Aucun employé actif avec une affectation salariale trouvé.');
    }

    // Deduplicate: keep most-recent per userId (assignments may have multiple effective dates)
    const latestByUser = new Map<string, typeof assignments[0]>();
    for (const a of assignments) {
      if (!latestByUser.has(a.userId)) {
        latestByUser.set(a.userId, a);
      }
    }

    const lines: typeof payrollRunLines.$inferInsert[] = [];
    for (const [, a] of latestByUser) {
      const gross = Number(a.baseSalary);
      const calc = calculatePayslipLine({ grossMonthlySalary: gross });
      lines.push({
        tenantId,
        periodId,
        userId: a.userId,
        grossSalary: String(calc.grossSalary),
        cnssEmployee: String(calc.cnssEmployee),
        amoEmployee: String(calc.amoEmployee),
        irTax: String(calc.irTax),
        netSalary: String(calc.netSalary),
        cnssEmployer: String(calc.cnssEmployer),
        amoEmployer: String(calc.amoEmployer),
        totalEmployerCost: String(calc.totalEmployerCost),
        calculationSnapshot: calc.snapshot,
      });
    }

    // Upsert all lines (idempotent recalculation)
    await db
      .insert(payrollRunLines)
      .values(lines)
      .onConflictDoUpdate({
        target: [payrollRunLines.periodId, payrollRunLines.userId],
        set: {
          grossSalary: payrollRunLines.grossSalary,
          cnssEmployee: payrollRunLines.cnssEmployee,
          amoEmployee: payrollRunLines.amoEmployee,
          irTax: payrollRunLines.irTax,
          netSalary: payrollRunLines.netSalary,
          cnssEmployer: payrollRunLines.cnssEmployer,
          amoEmployer: payrollRunLines.amoEmployer,
          totalEmployerCost: payrollRunLines.totalEmployerCost,
          calculationSnapshot: payrollRunLines.calculationSnapshot,
        },
      });

    return NextResponse.json({ success: true, data: { periodId, linesCalculated: lines.length } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
