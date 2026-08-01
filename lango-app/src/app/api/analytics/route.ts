import { and, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance, classSections, expenses, invoices, payments, user } from '@/models/Schema';

// ponytail: reuses the same "parallel aggregate queries, no fabricated
// numbers" pattern as /api/dashboard/summary. Grade/mention data and
// cycle-based (Primaire/Collège/Lycée) segmentation are intentionally
// omitted - grades have no real backing yet (see MIGRATION-NOTES.md,
// assessment schema gap) and `user.cycle` is never set for students, only
// teachers.

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const sixMonthsAgo = monthsAgo(6);
    const thirtyDaysAgo = monthsAgo(1);

    const [
      studentCountRows,
      teacherCountRows,
      classCountRows,
      enrollmentByMonth,
      attendanceByMonth,
      invoicedByMonth,
      collectedByMonth,
      expensesByMonth,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher'))),
      db.select({ count: sql<number>`count(*)::int` }).from(classSections).where(eq(classSections.tenantId, tenantId)),
      db.select({ month: sql<string>`to_char(${user.createdAt}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), gte(user.createdAt, sixMonthsAgo)))
        .groupBy(sql`to_char(${user.createdAt}, 'YYYY-MM')`),
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), gte(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.status),
      db.select({ month: sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${invoices.issueDate}::date, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${expenses.amount}), 0)::float` })
        .from(expenses)
        .where(and(eq(expenses.tenantId, tenantId), gte(expenses.expenseDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`),
    ]);

    // Build a real 6-month series, filling zeros for months with no rows -
    // "nothing happened" is a real fact, not a gap to hide. Anchored to the
    // 1st of the month before subtracting - subtracting months from today's
    // day-of-month (e.g. the 31st) rolls over into the wrong month for any
    // target month with fewer days (setMonth has no "clamp" mode).
    const firstOfThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(firstOfThisMonth);
      d.setMonth(d.getMonth() - (5 - i));
      return d.toISOString().slice(0, 7);
    });
    function toCountMap(rows: { month: string; count: number }[]): Map<string, number> {
      return new Map(rows.map(r => [r.month, r.count]));
    }
    function toTotalMap(rows: { month: string; total: number }[]): Map<string, number> {
      return new Map(rows.map(r => [r.month, r.total]));
    }
    const enrollmentMap = toCountMap(enrollmentByMonth);
    const invoicedMap = toTotalMap(invoicedByMonth);
    const collectedMap = toTotalMap(collectedByMonth);
    const expensesMap = toTotalMap(expensesByMonth);

    const enrollmentTrend = months.map(m => ({ month: m, newStudents: enrollmentMap.get(m) ?? 0 }));
    const revenueTrend = months.map(m => ({ month: m, invoiced: invoicedMap.get(m) ?? 0, collected: collectedMap.get(m) ?? 0, expenses: expensesMap.get(m) ?? 0 }));

    const presentCount = attendanceByMonth.find(a => a.status === 'present')?.count ?? 0;
    const totalMarked = attendanceByMonth.reduce((sum, a) => sum + a.count, 0);
    const attendanceRate30d = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 1000) / 10 : null;

    return NextResponse.json({
      success: true,
      data: {
        totalStudents: studentCountRows[0]?.count ?? 0,
        totalTeachers: teacherCountRows[0]?.count ?? 0,
        activeClasses: classCountRows[0]?.count ?? 0,
        attendanceRate30d,
        enrollmentTrend,
        revenueTrend,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
