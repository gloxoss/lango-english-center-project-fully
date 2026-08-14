import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { employeeLeaveBalances, leaveCategories, payrollPeriods, payrollRunLines, user } from '@/models/Schema';
import { checkDomainReadiness } from '../services/readiness-checker';

// Extracted as a pure, independently-testable rule (future-implementation
// /advanced-reporting remediation, section-09) - the small-group privacy
// suppression invariant a prior "verified" claim fabricated evidence for.
export function isPayrollGroupMasked(headcount: number): boolean {
  return headcount < 3;
}

export class HRAdapter {
  /**
   * 1. Payroll Summary Report with Small-Group Privacy Suppression (< 3 staff masked).
   * Groups by role (this schema has no separate "department" concept - role is
   * the real, existing grouping dimension for staff), from the most recent
   * payroll period.
   */
  static async getPayrollSummaryReport(tenantId: string, params?: any) {
    const readiness = checkDomainReadiness('HR');
    if (!readiness.isReady) {
      throw new Error(`Module RH non disponible: ${readiness.reason}`);
    }

    const [latestPeriod] = await db
      .select({ id: payrollPeriods.id })
      .from(payrollPeriods)
      .where(eq(payrollPeriods.tenantId, tenantId))
      .orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month))
      .limit(1);

    if (!latestPeriod) {
      return [];
    }

    const lines = await db
      .select({
        role: user.role,
        grossSalary: payrollRunLines.grossSalary,
        netSalary: payrollRunLines.netSalary,
      })
      .from(payrollRunLines)
      .innerJoin(user, eq(payrollRunLines.userId, user.id))
      .where(and(eq(payrollRunLines.tenantId, tenantId), eq(payrollRunLines.periodId, latestPeriod.id)));

    const byRole = new Map<string, { headcount: number; grossPay: number; netPay: number }>();
    for (const line of lines) {
      const entry = byRole.get(line.role) ?? { headcount: 0, grossPay: 0, netPay: 0 };
      entry.headcount += 1;
      entry.grossPay += Number(line.grossSalary);
      entry.netPay += Number(line.netSalary);
      byRole.set(line.role, entry);
    }

    return Array.from(byRole.entries()).map(([department, dept]) => {
      const isMasked = isPayrollGroupMasked(dept.headcount);
      return {
        department,
        headcount: dept.headcount,
        grossPay: isMasked ? '[Masqué - Effectif < 3]' : dept.grossPay,
        netPay: isMasked ? '[Masqué - Effectif < 3]' : dept.netPay,
      };
    });
  }

  /**
   * 2. Leave Balances Report.
   */
  static async getLeaveBalancesReport(tenantId: string, params?: any) {
    const readiness = checkDomainReadiness('HR');
    if (!readiness.isReady) {
      throw new Error(`Module RH non disponible: ${readiness.reason}`);
    }

    const currentYear = new Date().getFullYear();
    const rows = await db
      .select({
        employeeName: user.name,
        leaveType: leaveCategories.name,
        entitledDays: leaveCategories.daysPerYear,
        usedDays: employeeLeaveBalances.usedDays,
        accruedDays: employeeLeaveBalances.accruedDays,
      })
      .from(employeeLeaveBalances)
      .innerJoin(user, eq(employeeLeaveBalances.userId, user.id))
      .innerJoin(leaveCategories, eq(employeeLeaveBalances.categoryId, leaveCategories.id))
      .where(and(eq(employeeLeaveBalances.tenantId, tenantId), eq(employeeLeaveBalances.year, currentYear)));

    return rows.map(r => {
      const entitled = r.entitledDays ?? Number(r.accruedDays);
      const used = Number(r.usedDays);
      return {
        employeeName: r.employeeName,
        leaveType: r.leaveType,
        entitledDays: entitled,
        usedDays: used,
        remainingDays: entitled - used,
      };
    });
  }
}
