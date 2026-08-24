// Reconstructed 2026-08-24: the prior version of this file was truncated to zero
// bytes during a build on 2026-08-23 (external process, no git history to recover
// from). Restored to feed the leadership portal (school_admin-only) and the
// dashboard analytics page from real tenant-scoped data. Staff presence has no
// real source and returns null; the IGP is a weighted blend of attendance,
// academics and finance (see computeIgp) that only renders an empty state when
// none of its pillars has data for the period.

import { and, desc, eq, gte, gt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  announcements,
  assessments,
  assessmentResults,
  attendance,
  attendanceFlags,
  classes,
  expenses,
  invoices,
  meetingSlots,
  payments,
  user,
} from '@/models/Schema';

type RiskItem = { level: 'Critique' | 'Importante' | 'Modérée'; count: number; label: string };
type PriorityAction = { task: string; priority: 'Critique' | 'Haute' | 'Moyenne' };
type Insight = { icon: 'green' | 'blue' | 'orange'; title: string; desc: string };

const STAFF_ROLES = ['teacher', 'school_admin', 'accountant', 'receptionist', 'guard'] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const severityLevel = (s: string): RiskItem['level'] =>
  s === 'CRITIQUE' ? 'Critique' : s === 'ELEVE' ? 'Importante' : 'Modérée';

const flagTypeLabel = (t: string): string =>
  t === 'UNJUSTIFIED_ABSENCE' ? 'Absences non justifiées' : t === 'REPEATED_LATE' ? 'Retards répétés' : 'Absences consécutives';

// Indice Général de Performance (IGP) — a synthetic /100 leadership score that
// blends the three pillars that have real data, re-weighting them in proportion
// to their fixed weights so a partial dataset still yields a defensible index:
//   - Présence     (40%) : monthly presence rate (present / non-excused).
//   - Académique   (30%) : average assessment score (0–100).
//   - Recouvrement (30%) : collected / invoiced rate (0–100, clamped).
// Returns null only when none of the pillars has data for the period.
const IGP_PILLAR_WEIGHTS = { attendance: 0.4, academics: 0.3, finance: 0.3 } as const;

function computeIgp(
  attendanceRate: number | null,
  academicScore: number | null,
  collectionRate: number | null,
): number | null {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const pillars: { value: number; weight: number }[] = [];
  if (attendanceRate != null) pillars.push({ value: clamp(attendanceRate), weight: IGP_PILLAR_WEIGHTS.attendance });
  if (academicScore != null) pillars.push({ value: clamp(academicScore), weight: IGP_PILLAR_WEIGHTS.academics });
  if (collectionRate != null) pillars.push({ value: clamp(collectionRate), weight: IGP_PILLAR_WEIGHTS.finance });
  if (pillars.length === 0) return null;
  const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
  return Math.round((pillars.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight) * 10) / 10;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const today = isoDate(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const thirtyDaysAgo = isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const sixMonthsAgo = isoDate(new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000));
    const nowIso = new Date().toISOString();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range');
    const periodFrom = range === '30d' ? thirtyDaysAgo : sixMonthsAgo;

    const [
      studentCountRows,
      teacherCountRows,
      staffCountRows,
      activeClassRows,
      studentsThisMonthRows,
      attendance30Rows,
      invoicedRows,
      collectedRows,
      outstandingRows,
      discountsRows,
      avgGradeRows,
      flagsRows,
      overdueRows,
      lockedRows,
      enrollmentRows,
      invoicedTrendRows,
      collectedTrendRows,
      expensesTrendRows,
      announcementsRows,
      meetingsRows,
      attendanceMonthlyRows,
      academicMonthlyRows,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), sql`${user.role} in ('teacher', 'school_admin', 'accountant', 'receptionist', 'guard')`)),
      db.select({ count: sql<number>`count(*)::int` }).from(classes).where(eq(classes.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), gte(user.createdAt, monthStart))),
      db.select({ status: attendance.status, count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), eq(attendance.isVoided, false), gte(attendance.date, thirtyDaysAgo)))
        .groupBy(attendance.status),
      db.select({ total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.status} not in ('draft', 'cancelled', 'credited')`)),
      db.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.status, 'posted'))),
      db.select({ total: sql<number>`coalesce(sum(${invoices.netAmount} - ${invoices.paidAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.status} not in ('draft', 'cancelled', 'credited')`)),
      db.select({ total: sql<number>`coalesce(sum(${invoices.discountAmount}), 0)::float` })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.status} not in ('draft', 'cancelled', 'credited')`)),
      db.select({
        avg: sql<number>`coalesce(avg(${assessmentResults.finalPercentage}), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
        .from(assessmentResults)
        .where(and(eq(assessmentResults.tenantId, tenantId), sql`${assessmentResults.finalPercentage} is not null`)),
      db.select({
        severity: attendanceFlags.severity,
        type: attendanceFlags.type,
        count: sql<number>`count(*)::int`,
      })
        .from(attendanceFlags)
        .where(and(eq(attendanceFlags.tenantId, tenantId), eq(attendanceFlags.status, 'OPEN')))
        .groupBy(attendanceFlags.severity, attendanceFlags.type),
      db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue'))),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(and(eq(user.tenantId, tenantId), gt(user.lockedUntil, nowIso))),
      db.select({
        month: sql<string>`to_char(${user.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), gte(user.createdAt, sixMonthsAgo)))
        .groupBy(sql`to_char(${user.createdAt}, 'YYYY-MM')`),
      db.select({
        month: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
      })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), gte(invoices.issueDate, sixMonthsAgo), sql`${invoices.status} not in ('draft', 'cancelled', 'credited')`))
        .groupBy(sql`to_char(${invoices.issueDate}, 'YYYY-MM')`),
      db.select({
        month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
      })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.paymentDate, sixMonthsAgo), eq(payments.status, 'posted')))
        .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`),
      db.select({
        month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)::float`,
      })
        .from(expenses)
        .where(and(eq(expenses.tenantId, tenantId), gte(expenses.expenseDate, sixMonthsAgo)))
        .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`),
      db.select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        publishedAt: announcements.publishedAt,
        authorName: user.name,
      })
        .from(announcements)
        .innerJoin(user, eq(announcements.createdById, user.id))
        .where(and(eq(announcements.tenantId, tenantId), sql`${announcements.publishedAt} is not null`))
        .orderBy(desc(announcements.publishedAt))
        .limit(5),
      db.select({
        id: meetingSlots.id,
        startTime: meetingSlots.startTime,
        teacherName: user.name,
      })
        .from(meetingSlots)
        .innerJoin(user, eq(meetingSlots.teacherId, user.id))
        .where(and(
          eq(meetingSlots.tenantId, tenantId),
          eq(meetingSlots.status, 'booked'),
          sql`${meetingSlots.bookedByGuardianId} is not null`,
          gte(meetingSlots.startTime, nowIso),
        ))
        .orderBy(meetingSlots.startTime)
        .limit(5),
      db.select({
        month: sql<string>`to_char(${attendance.date}, 'YYYY-MM')`,
        present: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
        marked: sql<number>`count(*) filter (where ${attendance.status} <> 'excused')::int`,
      })
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.isVoided, false),
          gte(attendance.date, sixMonthsAgo),
        ))
        .groupBy(sql`to_char(${attendance.date}, 'YYYY-MM')`),
      db.select({
        month: sql<string>`to_char(${assessments.assessmentDate}, 'YYYY-MM')`,
        avg: sql<number>`coalesce(avg(${assessmentResults.finalPercentage}), 0)::float`,
      })
        .from(assessmentResults)
        .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
        .where(and(
          eq(assessmentResults.tenantId, tenantId),
          sql`${assessmentResults.finalPercentage} is not null`,
          gte(assessments.assessmentDate, sixMonthsAgo),
        ))
        .groupBy(sql`to_char(${assessments.assessmentDate}, 'YYYY-MM')`),
    ]);

    const totalStudents = studentCountRows[0]?.count ?? 0;
    const totalTeachers = teacherCountRows[0]?.count ?? 0;
    const totalStaff = staffCountRows[0]?.count ?? 0;
    const activeClasses = activeClassRows[0]?.count ?? 0;
    const studentsThisMonth = studentsThisMonthRows[0]?.count ?? 0;

    const markedRows = attendance30Rows.filter(r => r.status !== 'excused');
    const totalMarked = markedRows.reduce((sum, r) => sum + r.count, 0);
    const presentMarked = markedRows.filter(r => r.status === 'present').reduce((sum, r) => sum + r.count, 0);
    const attendanceRate30d = totalMarked > 0 ? Math.round((presentMarked / totalMarked) * 1000) / 10 : null;

    const invoicedTotal = invoicedRows[0]?.total ?? 0;
    const collectedTotal = collectedRows[0]?.total ?? 0;
    const outstandingTotal = Math.max(0, outstandingRows[0]?.total ?? 0);
    const discountsTotal = discountsRows[0]?.total ?? 0;
    const collectionRate = invoicedTotal > 0 ? Math.round((collectedTotal / invoicedTotal) * 1000) / 10 : null;

    const averageGrade = (avgGradeRows[0]?.count ?? 0) > 0 ? Math.round((avgGradeRows[0]?.avg ?? 0) * 10) / 10 : null;

    const months = lastMonths(6);
    const enrollMap = new Map(enrollmentRows.map(r => [r.month, r.count]));
    const invoicedTrendMap = new Map(invoicedTrendRows.map(r => [r.month, r.total]));
    const collectedTrendMap = new Map(collectedTrendRows.map(r => [r.month, r.total]));
    const expensesTrendMap = new Map(expensesTrendRows.map(r => [r.month, r.total]));

    const enrollmentTrend = months.map(m => ({ month: m, newStudents: enrollMap.get(m) ?? 0 }));
    const revenueTrend = months.map(m => ({
      month: m,
      invoiced: invoicedTrendMap.get(m) ?? 0,
      collected: collectedTrendMap.get(m) ?? 0,
      expenses: expensesTrendMap.get(m) ?? 0,
    }));

    // IGP: the composite score and its 6-month trend share one formula, computed
    // per calendar month so the two can never drift apart. Finance uses the same
    // month's collected/invoiced (clamped to 100); a month with no invoicing has
    // no finance pillar rather than a fabricated 0.
    const attendanceMonthlyMap = new Map<string, number | null>();
    for (const r of attendanceMonthlyRows) {
      attendanceMonthlyMap.set(r.month, r.marked > 0 ? (r.present / r.marked) * 100 : null);
    }
    const academicMonthlyMap = new Map<string, number>();
    for (const r of academicMonthlyRows) academicMonthlyMap.set(r.month, r.avg);

    const igpTrend = months.map((m) => {
      const invoiced = invoicedTrendMap.get(m) ?? 0;
      const collected = collectedTrendMap.get(m) ?? 0;
      const collectionRate = invoiced > 0 ? Math.min(100, (collected / invoiced) * 100) : null;
      return {
        month: m,
        igp: computeIgp(attendanceMonthlyMap.get(m) ?? null, academicMonthlyMap.get(m) ?? null, collectionRate) ?? 0,
      };
    });

    const monthsWithIgp = igpTrend.filter(t => t.igp > 0);
    const latestMonth = monthsWithIgp[monthsWithIgp.length - 1];
    const previousMonth = monthsWithIgp[monthsWithIgp.length - 2];
    const igpLatest = latestMonth ? latestMonth.igp : null;
    const igpDelta = latestMonth && previousMonth
      ? Math.round((latestMonth.igp - previousMonth.igp) * 10) / 10
      : null;

    // Alerts: open attendance flags (by severity/type), overdue invoices, and
    // locked accounts are reported separately by source — no invented aggregate.
    const risks: RiskItem[] = [];
    for (const row of flagsRows) {
      risks.push({ level: severityLevel(row.severity), count: row.count, label: flagTypeLabel(row.type) });
    }
    const overdueCount = overdueRows[0]?.count ?? 0;
    const lockedCount = lockedRows[0]?.count ?? 0;
    if (overdueCount > 0) risks.push({ level: overdueCount >= 5 ? 'Critique' : 'Importante', count: overdueCount, label: 'Factures en retard' });
    if (lockedCount > 0) risks.push({ level: lockedCount >= 5 ? 'Importante' : 'Modérée', count: lockedCount, label: 'Comptes verrouillés' });

    const criticalCount = risks.filter(r => r.level === 'Critique').reduce((s, r) => s + r.count, 0);
    const importantCount = risks.filter(r => r.level === 'Importante').reduce((s, r) => s + r.count, 0);
    const moderateCount = risks.filter(r => r.level === 'Modérée').reduce((s, r) => s + r.count, 0);

    const flagCount = flagsRows.reduce((s, r) => s + r.count, 0);
    const priorityActions: PriorityAction[] = [];
    if (flagCount > 0) priorityActions.push({ task: `Traiter ${flagCount} signalement(s) d'absence ouverts`, priority: criticalCount > 0 ? 'Critique' : 'Haute' });
    if (overdueCount > 0) priorityActions.push({ task: `Relancer ${overdueCount} facture(s) en retard`, priority: overdueCount >= 5 ? 'Haute' : 'Moyenne' });
    if (lockedCount > 0) priorityActions.push({ task: `Déverrouiller ${lockedCount} compte(s)`, priority: 'Moyenne' });

    const insights: Insight[] = [];
    if (studentsThisMonth > 0) insights.push({ icon: 'green', title: 'Nouvelles inscriptions', desc: `${studentsThisMonth} élève(s) inscrit(s) ce mois-ci.` });
    if (collectionRate != null && collectionRate < 60) insights.push({ icon: 'orange', title: 'Recouvrement à renforcer', desc: `Taux de recouvrement de ${collectionRate.toFixed(1)}% sur les frais facturés.` });
    if (attendanceRate30d != null && attendanceRate30d < 80) insights.push({ icon: 'orange', title: 'Présence à surveiller', desc: `Taux de présence de ${attendanceRate30d.toFixed(1)}% sur 30 jours.` });
    if (criticalCount + importantCount + moderateCount > 0) insights.push({ icon: 'orange', title: 'Alertes actives', desc: `${criticalCount + importantCount + moderateCount} alerte(s) non résolue(s) (présence, factures, comptes).` });

    const announcementList = announcementsRows.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      author: a.authorName,
      date: a.publishedAt ? a.publishedAt.slice(0, 10) : '',
    }));

    const meetingList = meetingsRows.map(m => ({
      id: m.id,
      date: m.startTime.slice(0, 10),
      time: m.startTime.slice(11, 16),
      title: 'Réunion parents',
      owner: m.teacherName,
      status: 'Réservé',
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        activeClasses,
        attendanceRate30d,
        enrollmentTrend,
        revenueTrend,
        studentsThisMonth,
        totalStaff,
        staffPresenceRate: null,
        finance: {
          invoicedTotal,
          collectedTotal,
          outstandingTotal,
          discountsTotal,
          collectionRate,
        },
        averageGrade,
        igpTrend,
        igpLatest,
        igpDelta,
        alerts: {
          criticalCount,
          importantCount,
          moderateCount,
          total: criticalCount + importantCount + moderateCount,
          risks,
          priorityActions,
        },
        insights,
        announcements: announcementList,
        meetings: meetingList,
        period: { from: periodFrom, to: today },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
