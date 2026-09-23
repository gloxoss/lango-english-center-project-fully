import { and, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { collectedPaymentCondition, invoicedInvoiceCondition, netCollectedSumSql, OVERDUE_INVOICE_STATUSES } from '@/libs/finance/definitions';
import { applicants, attendance, classes, classSections, invoices, payments, tenants, user } from '@/models/Schema';

type AttendanceRow = { date: string; status: 'present' | 'absent' | 'late' | 'excused'; count: number };

/** Build chart points from recorded attendance only. Missing days stay unknown. */
export function buildAttendanceInspection(rows: AttendanceRow[], today = new Date()): Array<{ date: string; studentRate: number | null; employeeRate: number | null }> {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (6 - index)));
    const iso = day.toISOString().slice(0, 10);
    const dayRows = rows.filter(row => row.date.slice(0, 10) === iso);
    const total = dayRows.reduce((sum, row) => sum + row.count, 0);
    const attended = dayRows
      .filter(row => row.status === 'present' || row.status === 'late')
      .reduce((sum, row) => sum + row.count, 0);

    return {
      date: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      studentRate: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
      // Employee attendance has no expected-workday table, so the dashboard
      // must leave it unknown instead of turning punch counts into a rate.
      employeeRate: null,
    };
  });
}

export function openInvoiceBalance(netAmount: number, paidAmount: number): number {
  return netAmount > paidAmount ? netAmount - paidAmount : 0;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const monthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthStart = monthStartDate.toISOString();
    const nextMonthStart = nextMonthStartDate.toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)).toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);

    const [
      schoolsRows,
      studentCountRows,
      teacherCountRows,
      parentCountRows,
      employeeCountRows,
      classCountRows,
      sectionCountRows,
      admissionsRows,
      invoiceCountRows,
      monthPaymentsRows,
      monthInvoicesRows,
      openInvoiceBalanceRows,
      allYearInvoices,
      allYearPayments,
      attendanceRows,
      studentsByBranchRows,
    ] = await Promise.all([
      db.select({
        id: tenants.id,
        name: tenants.name,
        isActive: tenants.isActive,
        planTier: tenants.planTier,
        subscriptionStatus: tenants.subscriptionStatus,
      }).from(tenants),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(eq(user.role, 'student')),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(eq(user.role, 'teacher')),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(eq(user.role, 'parent')),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(inArray(user.role, ['teacher', 'school_admin', 'accountant', 'receptionist', 'guard'])),
      db.select({ count: sql<number>`count(*)::int` }).from(classes),
      db.select({ count: sql<number>`count(*)::int` }).from(classSections),
      db.select({ count: sql<number>`count(*)::int` }).from(applicants).where(gte(applicants.applicationDate, thirtyDaysAgo)),
      db.select({ count: sql<number>`count(*)::int` }).from(invoices),
      db.select({ total: netCollectedSumSql(payments) })
        .from(payments)
        .where(and(gte(payments.paymentDate, monthStart), lt(payments.paymentDate, nextMonthStart), collectedPaymentCondition(payments.status))),
      db.select({ total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(gte(invoices.issueDate, monthStart), lt(invoices.issueDate, nextMonthStart), invoicedInvoiceCondition(invoices.status))),
      db.select({ total: sql<number>`coalesce(sum(greatest(${invoices.netAmount} - ${invoices.paidAmount}, 0)), 0)::float` })
        .from(invoices)
        .where(inArray(invoices.status, [...OVERDUE_INVOICE_STATUSES])),
      db.select({
        monthNum: sql<number>`extract(month from date(${invoices.issueDate}))::int`,
        netTotal: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
      })
        .from(invoices)
        .where(and(gte(invoices.issueDate, currentYear + '-01-01'), invoicedInvoiceCondition(invoices.status)))
        .groupBy(sql`extract(month from date(${invoices.issueDate}))::int`),
      db.select({
        monthNum: sql<number>`extract(month from date(${payments.paymentDate}))::int`,
        paidTotal: netCollectedSumSql(payments),
      })
        .from(payments)
        .where(and(gte(payments.paymentDate, currentYear + '-01-01'), collectedPaymentCondition(payments.status)))
        .groupBy(sql`extract(month from date(${payments.paymentDate}))::int`),
      db.select({ date: attendance.date, status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(gte(attendance.date, sevenDaysAgo), lte(attendance.date, todayIso), eq(attendance.isVoided, false)))
        .groupBy(attendance.date, attendance.status),
      db.select({
        tenantId: user.tenantId,
        tenantName: tenants.name,
        count: sql<number>`count(*)::int`,
      })
        .from(user)
        .leftJoin(tenants, eq(user.tenantId, tenants.id))
        .where(eq(user.role, 'student'))
        .groupBy(user.tenantId, tenants.name),
    ]);

    const totalSchools = schoolsRows.length;
    const activeSchools = schoolsRows.filter(s => s.subscriptionStatus === 'active' && s.isActive).length;
    const totalStudents = studentCountRows[0]?.count ?? 0;
    const totalTeachers = teacherCountRows[0]?.count ?? 0;
    const totalParents = parentCountRows[0]?.count ?? 0;
    const totalEmployees = employeeCountRows[0]?.count ?? totalTeachers;
    const activeClassesCount = classCountRows[0]?.count ?? 0;
    const vouchersCount = invoiceCountRows[0]?.count ?? 0;

    const monthPaymentsTotal = Number(monthPaymentsRows[0]?.total ?? 0);
    const monthInvoicesTotal = monthInvoicesRows[0]?.total ?? 0;
    const outstandingBalance = Number(openInvoiceBalanceRows[0]?.total ?? 0);

    const globalIncomeVsExpense = {
      collected: monthPaymentsTotal,
      remaining: outstandingBalance,
      invoiced: monthInvoicesTotal,
    };

    const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const invoicedMap = new Map(allYearInvoices.map(r => [r.monthNum, r.netTotal]));
    const paidMap = new Map(allYearPayments.map(r => [r.monthNum, Number(r.paidTotal ?? 0)]));

    const globalAnnualFeeSummary = MONTH_LABELS.map((label, idx) => {
      const mNum = idx + 1;
      const total = invoicedMap.get(mNum) ?? 0;
      const collected = paidMap.get(mNum) ?? 0;
      return {
        month: label,
        total,
        collected,
        remaining: total - collected,
      };
    });

    const studentQuantityByBranch = studentsByBranchRows
      .filter(r => r.tenantName != null)
      .map(r => ({ name: r.tenantName as string, count: r.count }));

    const globalWeeklyAttendanceInspection = buildAttendanceInspection(attendanceRows as AttendanceRow[], now);

    return NextResponse.json({
      success: true,
      data: {
        totalSchools,
        activeSchools,
        schools: schoolsRows,
        totalStudents,
        totalTeachers,
        totalParents,
        totalEmployees,
        admissions30Days: admissionsRows[0]?.count ?? 0,
        vouchersCount,
        activeClassesCount,
        totalSectionsCount: sectionCountRows[0]?.count ?? 0,
        globalIncomeVsExpense,
        globalAnnualFeeSummary,
        studentQuantityByBranch,
        globalWeeklyAttendanceInspection,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
