import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance, classes, classSections, invoices, payments, sections, user } from '@/models/Schema';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const today = todayIso();
    const monthStart = monthStartIso();
    const currentYear = new Date().getFullYear();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [
      studentCountRows,
      teacherCountRows,
      parentCountRows,
      employeeCountRows,
      admissions30Rows,
      classCountRows,
      classSectionCountRows,
      invoiceCountRows,
      todayAttendanceRows,
      monthPaymentsRows,
      monthInvoicesRows,
      recentPaymentRows,
      overdueInvoicesCountRows,
      absenceCounts,
      overdueByStudent,
      weeklyAttendanceRows,
      allYearInvoices,
      allYearPayments,
      studentsByClassRows,
      birthdaysRows,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'parent'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), inArray(user.role, ['teacher', 'school_admin', 'accountant', 'receptionist', 'guard']))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), gte(user.createdAt, thirtyDaysAgo))),
      db.select({ count: sql<number>`count(*)::int` }).from(classes).where(eq(classes.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)::int` }).from(classSections).where(eq(classSections.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenantId, tenantId)),
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, today)))
        .groupBy(attendance.status),
      db.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, monthStart))),
      db.select({ total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, monthStart))),
      db.select({
        studentId: payments.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
      })
        .from(payments)
        .innerJoin(user, eq(payments.studentId, user.id))
        .where(eq(payments.tenantId, tenantId))
        .orderBy(desc(payments.paymentDate))
        .limit(5),
      db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue'))),
      db.select({
        studentId: attendance.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
        absentCount: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, eq(attendance.studentId, user.id))
        .where(and(eq(attendance.tenantId, tenantId), eq(attendance.status, 'absent'), gte(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.studentId, user.name, user.classSectionId)
        .having(sql`count(*) >= 2`),
      db.select({
        studentId: invoices.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
      })
        .from(invoices)
        .innerJoin(user, eq(invoices.studentId, user.id))
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')))
        .groupBy(invoices.studentId, user.name, user.classSectionId),
      db.select({
        date: attendance.date,
        status: attendance.status,
        count: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), gte(attendance.date, sevenDaysAgo)))
        .groupBy(attendance.date, attendance.status),
      db.select({
        month: sql<string>`to_char(date(${invoices.issueDate}), 'Mon')`,
        monthNum: sql<number>`extract(month from date(${invoices.issueDate}))::int`,
        netTotal: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
      })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, `${currentYear}-01-01`)))
        .groupBy(sql`to_char(date(${invoices.issueDate}), 'Mon')`, sql`extract(month from date(${invoices.issueDate}))::int`)
        .orderBy(sql`extract(month from date(${invoices.issueDate}))::int`),
      db.select({
        month: sql<string>`to_char(date(${payments.paymentDate}), 'Mon')`,
        monthNum: sql<number>`extract(month from date(${payments.paymentDate}))::int`,
        paidTotal: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
      })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, `${currentYear}-01-01`)))
        .groupBy(sql`to_char(date(${payments.paymentDate}), 'Mon')`, sql`extract(month from date(${payments.paymentDate}))::int`)
        .orderBy(sql`extract(month from date(${payments.paymentDate}))::int`),
      db.select({
        className: classes.name,
        count: sql<number>`count(*)::int`,
      })
        .from(user)
        .innerJoin(classSections, eq(user.classSectionId, classSections.id))
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .groupBy(classes.name),
      db.select({
        id: user.id,
        name: user.name,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
      })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), inArray(user.role, ['student', 'teacher', 'school_admin']))),
    ]);

    const totalStudents = studentCountRows[0]?.count ?? 0;
    const totalTeachers = teacherCountRows[0]?.count ?? 0;
    const totalParents = parentCountRows[0]?.count ?? 0;
    const totalEmployees = employeeCountRows[0]?.count ?? totalTeachers;
    const admissions30Days = admissions30Rows[0]?.count ?? 0;
    const vouchersCount = invoiceCountRows[0]?.count ?? 0;
    const activeClassesCount = classCountRows[0]?.count ?? 0;
    const totalSectionsCount = classSectionCountRows[0]?.count ?? 0;

    const monthPaymentsTotal = monthPaymentsRows[0]?.total ?? 0;
    const monthInvoicesTotal = monthInvoicesRows[0]?.total ?? 0;
    const overdueInvoicesCount = overdueInvoicesCountRows[0]?.count ?? 0;

    // Build Income vs Expense
    const incomeVsExpense = {
      collected: monthPaymentsTotal,
      remaining: Math.max(0, monthInvoicesTotal - monthPaymentsTotal),
      invoiced: monthInvoicesTotal,
    };

    // Build 12-month Annual Fee Summary
    const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const invoicedMap = new Map(allYearInvoices.map(r => [r.monthNum, r.netTotal]));
    const paidMap = new Map(allYearPayments.map(r => [r.monthNum, r.paidTotal]));

    const annualFeeSummary = MONTH_LABELS.map((label, idx) => {
      const mNum = idx + 1;
      const total = invoicedMap.get(mNum) ?? 0;
      const collected = paidMap.get(mNum) ?? 0;
      return {
        month: label,
        total,
        collected,
        remaining: Math.max(0, total - collected),
      };
    });

    // Student quantity by class/cycle - real grouped counts only, no invented split
    const studentQuantityByLevel = studentsByClassRows.map(r => ({ name: r.className, count: r.count }));

    // Build Weekly Attendance Inspection
    const byDate = new Map<string, { present: number; total: number }>();
    for (const row of weeklyAttendanceRows) {
      const entry = byDate.get(row.date) ?? { present: 0, total: 0 };
      entry.total += row.count;
      if (row.status === 'present') {
        entry.present += row.count;
      }
      byDate.set(row.date, entry);
    }

    const weeklyAttendanceInspection = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      const entry = byDate.get(iso);
      const sRate = entry && entry.total > 0 ? Math.round((entry.present / entry.total) * 1000) / 10 : null;
      return {
        date: iso.slice(8, 10) + '/' + iso.slice(5, 7),
        studentRate: sRate,
        // No real employee-attendance tracking exists anywhere in this app
        // (attendance is student-only) - never fabricate a staff rate.
        employeeRate: null,
      };
    });

    // Birthdays today filtering
    const todayMonthDay = today.slice(5, 10); // MM-DD
    const studentBirthdays: { id: string; name: string; role: 'student'; detail: string }[] = [];
    const employeeBirthdays: { id: string; name: string; role: 'teacher' | 'staff'; detail: string }[] = [];

    for (const p of birthdaysRows) {
      if (p.dateOfBirth && p.dateOfBirth.slice(5, 10) === todayMonthDay) {
        if (p.role === 'student') {
          studentBirthdays.push({ id: p.id, name: p.name, role: 'student', detail: 'Élève' });
        } else {
          employeeBirthdays.push({ id: p.id, name: p.name, role: p.role === 'teacher' ? 'teacher' : 'staff', detail: p.role === 'teacher' ? 'Enseignant' : 'Personnel' });
        }
      }
    }

    // Resolve class names for recent payments & at-risk
    const neededSectionIds = [...new Set([
      ...recentPaymentRows.map(r => r.classSectionId),
      ...absenceCounts.map(r => r.classSectionId),
      ...overdueByStudent.map(r => r.classSectionId),
    ].filter((v): v is string => Boolean(v)))];

    const classSectionNames = new Map<string, string>();
    if (neededSectionIds.length > 0) {
      const rows = await db
        .select({ id: classSections.id, className: classes.name, sectionName: sections.name })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(inArray(classSections.id, neededSectionIds));
      for (const row of rows) {
        classSectionNames.set(row.id, `${row.className} ${row.sectionName}`.trim());
      }
    }
    const displayClass = (classSectionId: string | null) => (classSectionId ? classSectionNames.get(classSectionId) ?? '—' : '—');

    const presentToday = todayAttendanceRows.find(r => r.status === 'present')?.count ?? 0;
    const absentToday = todayAttendanceRows.find(r => r.status === 'absent')?.count ?? 0;
    const totalMarkedToday = todayAttendanceRows.reduce((sum, r) => sum + r.count, 0);

    const riskByStudent = new Map<string, { studentId: string; name: string; className: string; absences: number; hasOverdueInvoice: boolean }>();
    for (const row of absenceCounts) {
      riskByStudent.set(row.studentId, {
        studentId: row.studentId,
        name: row.studentName,
        className: displayClass(row.classSectionId),
        absences: row.absentCount,
        hasOverdueInvoice: false,
      });
    }
    for (const row of overdueByStudent) {
      const existing = riskByStudent.get(row.studentId);
      if (existing) {
        existing.hasOverdueInvoice = true;
      } else {
        riskByStudent.set(row.studentId, {
          studentId: row.studentId,
          name: row.studentName,
          className: displayClass(row.classSectionId),
          absences: 0,
          hasOverdueInvoice: true,
        });
      }
    }

    const atRiskStudents = [...riskByStudent.values()]
      .map(r => ({
        id: r.studentId,
        name: r.name,
        className: r.className,
        indicators: (r.absences > 0 ? 1 : 0) + (r.hasOverdueInvoice ? 1 : 0),
        riskLevel: r.absences >= 4 || (r.absences > 0 && r.hasOverdueInvoice) ? 'Risque élevé' : r.absences > 0 ? 'Risque moyen' : 'À surveiller',
        badge: r.absences >= 4 || (r.absences > 0 && r.hasOverdueInvoice) ? 'danger' : 'warning',
      }))
      .sort((a, b) => b.indicators - a.indicators)
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalEmployees,
        admissions30Days,
        vouchersCount,
        activeClassesCount,
        totalSectionsCount,
        todayAttendance: totalMarkedToday > 0
          ? { presentCount: presentToday, absentCount: absentToday, totalMarked: totalMarkedToday, rate: Math.round((presentToday / totalMarkedToday) * 1000) / 10 }
          : null,
        weeklyTrend: weeklyAttendanceInspection.map(w => ({ date: w.date, rate: w.studentRate })),
        incomeVsExpense,
        annualFeeSummary,
        studentQuantityByLevel,
        weeklyAttendanceInspection,
        recentPayments: recentPaymentRows.map(r => ({
          studentName: r.studentName,
          className: displayClass(r.classSectionId),
          amount: r.amount,
          date: r.paymentDate,
        })),
        overdueInvoicesCount,
        unjustifiedAbsencesToday: absentToday,
        atRiskStudents,
        todayBirthdays: {
          studentBirthdays,
          employeeBirthdays,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
