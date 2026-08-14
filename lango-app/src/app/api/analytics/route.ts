import { and, asc, desc, eq, gte, gt, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import {
  announcements, attendance, attendanceFlags, assessmentResults, classSections,
  expenses, invoices, meetingSlots, payments, user,
} from '@/models/Schema';

// ponytail: reuses the same "parallel aggregate queries, no fabricated
// numbers" pattern as /api/dashboard/summary. Every number below is derived
// from the tenant's real rows. When a domain has no backing data yet (grades,
// staff attendance), the value is null and the UI renders "données
// insuffisantes" — never an invented figure.
//
// IGP (Indice Global de Performance) is a derived composite, documented here:
//   enrollmentIdx(m) = newStudents[m] / max(newStudents in window) * 100
//   financeIdx(m)    = collected[m] / invoiced[m] * 100   (0 when invoiced=0)
//   igp(m)           = round(0.5 * enrollmentIdx(m) + 0.5 * financeIdx(m))
// It is 0 for months with no activity and "—" when the whole window is empty.

// Month/day anchors are computed in UTC to match the DB session's UTC
// bucketing (`to_char(..., 'YYYY-MM')`). Building dates from local-time
// components then calling toISOString() rolls local midnight back a day in
// timezones ahead of UTC (e.g. Africa/Casablanca GMT+1 in summer), which
// duplicates month labels and mislabels the current month.
function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    // Capability-driven so an explicitly assigned tenant-wide leadership
    // profile can reuse this projection. Narrower leadership scopes are
    // blocked by the /api/leadership facade until scoped aggregates exist.
    const context = await requireRequestContext(request);
    await requireCapability(context, 'analytics.read');
    const tenantId = requireTenant(context);
    // Optional range selector (30d / 6mo) controls the length of the finance
    // and enrollment series; the attendance rate stays a 30-day window either way.
    const rangeParam = new URL(request.url).searchParams.get('range');
    const seriesMonths = rangeParam === '30d' ? 1 : 6;
    const windowAgo = monthsAgo(seriesMonths);
    const thirtyDaysAgo = monthsAgo(1);
    const sixtyDaysAgo = monthsAgo(2);

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
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), gte(user.createdAt, windowAgo)))
        .groupBy(sql`to_char(${user.createdAt}, 'YYYY-MM')`),
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), gte(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.status),
      db.select({ month: sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, windowAgo)))
        .groupBy(sql`to_char(${invoices.issueDate}::date, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, windowAgo)))
        .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`),
      db.select({ month: sql<string>`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${expenses.amount}), 0)::float` })
        .from(expenses)
        .where(and(eq(expenses.tenantId, tenantId), gte(expenses.expenseDate, windowAgo)))
        .groupBy(sql`to_char(${expenses.expenseDate}::date, 'YYYY-MM')`),
    ]);

    // Build a real monthly series (length driven by the range selector),
    // filling zeros for months with no rows - "nothing happened" is a real
    // fact, not a gap to hide. Anchored to the 1st of the month in UTC
    // (matching the DB's UTC to_char bucketing) before subtracting - this
    // avoids both the day-of-month clamp problem and the local-midnight
    // UTC-rollover that would mislabel months in GMT+ timezones.
    const firstOfThisMonth = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
    const months = Array.from({ length: seriesMonths }, (_, i) => {
      const d = new Date(firstOfThisMonth);
      d.setUTCMonth(d.getUTCMonth() - (seriesMonths - 1 - i));
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

    // ------------------------------------------------------------------
    // Leadership-portal aggregates (all tenant-scoped, all real)
    // ------------------------------------------------------------------
    const nowIso = new Date().toISOString();
    const staffRoles = ['teacher', 'receptionist', 'accountant', 'guard', 'school_admin'] as const;

    const [
      staffCountRows,
      staffAttendanceRows,
      attendancePrevRows,
      financeRows,
      paymentsTotalRows,
      gradeRows,
      flagSeverityRows,
      overdueRows,
      lockedRows,
      announcementRows,
      meetingRows,
    ] = await Promise.all([
      // Total staff (for the personnel card).
      db.select({ count: sql<number>`count(*)::int` }).from(user)
        .where(and(eq(user.tenantId, tenantId), inArray(user.role, staffRoles))),
      // Staff presence = attendance rows recorded against staff user ids (real, rarely populated).
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .innerJoin(user, eq(attendance.studentId, user.id))
        .where(and(eq(attendance.tenantId, tenantId), inArray(user.role, staffRoles), gte(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.status),
      // Prior 30-day window for the attendance delta.
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), gte(attendance.date, sixtyDaysAgo), lt(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.status),
      // Finance totals (non-cancelled invoices).
      db.select({
        invoiced: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
        discounts: sql<number>`coalesce(sum(${invoices.discountAmount}), 0)::float`,
      })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), ne(invoices.status, 'cancelled'))),
      // Cash actually collected (payments).
      db.select({ collected: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(eq(payments.tenantId, tenantId)),
      // Average grade across real assessment results (null when none).
      db.select({ avg: sql<number>`avg(${assessmentResults.finalPercentage})::float` })
        .from(assessmentResults)
        .where(eq(assessmentResults.tenantId, tenantId)),
      // Open attendance flags grouped by severity.
      db.select({ severity: attendanceFlags.severity, count: sql<number>`count(*)::int` })
        .from(attendanceFlags)
        .where(and(eq(attendanceFlags.tenantId, tenantId), eq(attendanceFlags.status, 'OPEN')))
        .groupBy(attendanceFlags.severity),
      // Overdue invoices.
      db.select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue'))),
      // Locked accounts (users locked until a future timestamp).
      db.select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), isNotNull(user.lockedUntil), gt(user.lockedUntil, nowIso))),
      // Latest institutional announcements.
      db.select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        authorName: user.name,
        publishedAt: announcements.publishedAt,
      })
        .from(announcements)
        .leftJoin(user, eq(announcements.createdById, user.id))
        .where(eq(announcements.tenantId, tenantId))
        .orderBy(desc(announcements.publishedAt))
        .limit(5),
      // Upcoming parent-teacher meeting slots.
      db.select({
        id: meetingSlots.id,
        startTime: meetingSlots.startTime,
        status: meetingSlots.status,
        teacherName: user.name,
      })
        .from(meetingSlots)
        .leftJoin(user, eq(meetingSlots.teacherId, user.id))
        .where(and(eq(meetingSlots.tenantId, tenantId), ne(meetingSlots.status, 'cancelled'), gt(meetingSlots.startTime, nowIso)))
        .orderBy(asc(meetingSlots.startTime))
        .limit(5),
    ]);

    // -- Attendance delta vs prior 30 days ---------------------------------
    const presentPrev = attendancePrevRows.find(a => a.status === 'present')?.count ?? 0;
    const totalPrev = attendancePrevRows.reduce((sum, a) => sum + a.count, 0);
    const attendanceRatePrev = totalPrev > 0 ? (presentPrev / totalPrev) * 100 : null;
    const attendanceDelta = attendanceRate30d != null && attendanceRatePrev != null
      ? Math.round((attendanceRate30d - attendanceRatePrev) * 10) / 10
      : null;

    // -- Staff presence ------------------------------------------------------
    const totalStaff = staffCountRows[0]?.count ?? 0;
    const staffPresent = staffAttendanceRows.find(a => a.status === 'present')?.count ?? 0;
    const staffTotalMarked = staffAttendanceRows.reduce((sum, a) => sum + a.count, 0);
    const staffPresenceRate = staffTotalMarked > 0
      ? Math.round((staffPresent / staffTotalMarked) * 1000) / 10
      : null;

    // -- Finance --------------------------------------------------------------
    const invoicedTotal = financeRows[0]?.invoiced ?? 0;
    const discountsTotal = financeRows[0]?.discounts ?? 0;
    const collectedTotal = paymentsTotalRows[0]?.collected ?? 0;
    const outstandingTotal = Math.max(0, invoicedTotal - collectedTotal);
    const collectionRate = invoicedTotal > 0
      ? Math.round((collectedTotal / invoicedTotal) * 1000) / 10
      : null;

    // -- Grades ----------------------------------------------------------------
    const averageGrade = gradeRows[0]?.avg ?? null;

    // -- Alerts -----------------------------------------------------------------
    const critFlags = flagSeverityRows.find(r => r.severity === 'CRITIQUE')?.count ?? 0;
    const elevFlags = flagSeverityRows.find(r => r.severity === 'ELEVE')?.count ?? 0;
    const moyenFlags = flagSeverityRows.find(r => r.severity === 'MOYEN')?.count ?? 0;
    const overdueCount = overdueRows[0]?.count ?? 0;
    const lockedCount = lockedRows[0]?.count ?? 0;
    const criticalCount = critFlags;
    const importantCount = elevFlags + overdueCount + lockedCount;
    const moderateCount = moyenFlags;
    const totalAlerts = criticalCount + importantCount + moderateCount;

    const risks: { level: 'Critique' | 'Importante' | 'Modérée'; count: number; label: string }[] = [];
    if (critFlags > 0) risks.push({ level: 'Critique', count: critFlags, label: 'Alertes de présence critiques' });
    if (overdueCount > 0) risks.push({ level: 'Importante', count: overdueCount, label: 'Factures en souffrance (> échéance)' });
    if (lockedCount > 0) risks.push({ level: 'Importante', count: lockedCount, label: 'Comptes verrouillés' });
    if (elevFlags > 0) risks.push({ level: 'Importante', count: elevFlags, label: 'Retards / absences répétées' });
    if (moyenFlags > 0) risks.push({ level: 'Modérée', count: moyenFlags, label: 'Signaux de présence modérés' });
    if (risks.length === 0) risks.push({ level: 'Modérée', count: 0, label: 'Aucun risque détecté' });

    const priorityActions: { task: string; priority: 'Critique' | 'Haute' | 'Moyenne' }[] = [];
    if (critFlags > 0) priorityActions.push({ task: `Traiter les ${critFlags} alertes de présence critiques`, priority: 'Critique' });
    if (overdueCount > 0) priorityActions.push({ task: `Relancer les ${overdueCount} factures en souffrance`, priority: 'Haute' });
    if (lockedCount > 0) priorityActions.push({ task: `Déverrouiller les ${lockedCount} comptes verrouillés`, priority: 'Haute' });
    if (priorityActions.length === 0) priorityActions.push({ task: 'Aucune action prioritaire requise', priority: 'Moyenne' });

    // -- Insights (real deltas only, no invented trends) --------------------------
    const insights: { icon: 'green' | 'blue' | 'orange'; title: string; desc: string }[] = [];
    if (attendanceRate30d != null) {
      const deltaLabel = attendanceDelta != null
        ? ` (${attendanceDelta >= 0 ? '+' : ''}${attendanceDelta.toFixed(1)} pt vs 30 jours précédents)`
        : '';
      insights.push({
        icon: 'green',
        title: 'Taux de présence élèves',
        desc: `Le taux de présence est de ${attendanceRate30d}%${deltaLabel}.`,
      });
    }
    if (collectionRate != null) {
      const lastMonth = revenueTrend[revenueTrend.length - 1];
      const prevMonth = revenueTrend[revenueTrend.length - 2];
      const lastMonthRate = lastMonth && lastMonth.invoiced > 0 ? (lastMonth.collected / lastMonth.invoiced) * 100 : null;
      const prevMonthRate = prevMonth && prevMonth.invoiced > 0 ? (prevMonth.collected / prevMonth.invoiced) * 100 : null;
      const deltaLabel = lastMonthRate != null && prevMonthRate != null
        ? ` (${lastMonthRate - prevMonthRate >= 0 ? '+' : ''}${(Math.round((lastMonthRate - prevMonthRate) * 10) / 10).toFixed(1)} pt vs mois précédent)`
        : '';
      insights.push({
        icon: 'blue',
        title: 'Recouvrement des frais',
        desc: `Le recouvrement atteint ${collectionRate}% des montants facturés${deltaLabel}.`,
      });
    }
    if (criticalCount > 0) {
      insights.push({
        icon: 'orange',
        title: 'Alertes critiques à traiter',
        desc: `${criticalCount} alerte(s) critique(s) requièrent votre attention prioritaire.`,
      });
    }

    // -- IGP derived composite ----------------------------------------------------
    const maxNew = Math.max(1, ...enrollmentTrend.map(e => e.newStudents));
    const igpTrend = months.map((month, i) => {
      const newStudents = enrollmentTrend[i]?.newStudents ?? 0;
      const invoiced = revenueTrend[i]?.invoiced ?? 0;
      const collected = revenueTrend[i]?.collected ?? 0;
      const enrollmentIdx = maxNew > 0 ? Math.round((newStudents / maxNew) * 100) : 0;
      const financeIdx = invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : 0;
      return { month, igp: Math.round(0.5 * enrollmentIdx + 0.5 * financeIdx) };
    });
    const hasIgpData = igpTrend.some(t => t.igp > 0);
    const igpLatest = igpTrend.length > 0 ? igpTrend[igpTrend.length - 1]?.igp ?? null : null;
    const igpDelta = igpTrend.length >= 2
      ? (igpTrend[igpTrend.length - 1]?.igp ?? 0) - (igpTrend[igpTrend.length - 2]?.igp ?? 0)
      : null;

    // -- Announcements & meetings -------------------------------------------------
    const recentAnnouncements = announcementRows.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      author: a.authorName ?? 'Système',
      date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('fr-FR') : '—',
    }));
    const upcomingMeetings = meetingRows.map(m => {
      const d = new Date(m.startTime);
      return {
        id: m.id,
        date: d.toLocaleDateString('fr-FR'),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        title: `${m.teacherName ?? 'Enseignant'} — Rendez-vous parents`,
        owner: m.teacherName ?? '—',
        status: m.status === 'booked' ? 'Réservé' : 'Disponible',
      };
    });

    // -- Period label -------------------------------------------------------------
    const newThisMonth = enrollmentTrend[enrollmentTrend.length - 1]?.newStudents ?? 0;
    const fromDate = seriesMonths === 1
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : new Date(`${months[0]}-01`);
    const fromLabel = fromDate.toLocaleDateString('fr-FR');
    const toLabel = new Date().toLocaleDateString('fr-FR');

    return NextResponse.json({
      success: true,
      data: {
        totalStudents: studentCountRows[0]?.count ?? 0,
        totalTeachers: teacherCountRows[0]?.count ?? 0,
        activeClasses: classCountRows[0]?.count ?? 0,
        attendanceRate30d,
        enrollmentTrend,
        revenueTrend,
        studentsThisMonth: newThisMonth,
        totalStaff,
        staffPresenceRate,
        finance: {
          invoicedTotal,
          collectedTotal,
          outstandingTotal,
          discountsTotal,
          collectionRate,
        },
        averageGrade,
        igpTrend,
        igpLatest: hasIgpData ? igpLatest : null,
        igpDelta: hasIgpData ? igpDelta : null,
        alerts: {
          criticalCount,
          importantCount,
          moderateCount,
          total: totalAlerts,
          risks,
          priorityActions,
        },
        insights,
        announcements: recentAnnouncements,
        meetings: upcomingMeetings,
        period: { from: fromLabel, to: toLabel },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
