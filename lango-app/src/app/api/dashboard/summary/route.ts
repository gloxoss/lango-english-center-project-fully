import type {
  ActionCenterData,
  AttendanceTrendData,
  DailyPulseData,
  FinanceMonthlyBreakdown,
  FinanceOverviewData,
  FullDashboardSummary,
  RecentPaymentItem,
  StudentDistributionItem,
  UpcomingEventItem,
  WatchlistStudent,
} from '@/features/dashboard/model/types';
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { eventOccurrences, events, eventSchedules } from '@/features/events/models/events-schema';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  collectedPaymentCondition,
  invoicedInvoiceCondition,
  netCollectedSumSql,
  overdueInvoiceCondition,
} from '@/libs/finance/definitions';
import {
  attendance,
  attendanceExcuses,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  invoices,
  payments,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatMad(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId');
    const classSectionId = searchParams.get('classSectionId');

    const today = todayIso();
    const monthStart = monthStartIso();
    const currentYear = new Date().getFullYear();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // =========================================================================
    // 1. Authoritative Branch Scoping (P0 Security Invariant)
    // =========================================================================
    // If the principal is assigned to a specific branch (context.branchId),
    // they are strictly confined to that branch. Any client attempt to query
    // another branch or bypass branch scoping is rejected with 403.
    // If the principal is a whole-school admin (context.branchId === null),
    // they may query all branches or select a specific branch validated
    // against the tenant's active branches.
    let effectiveBranchId: string | null = null;
    if (context.branchId) {
      if (requestedBranchId && requestedBranchId !== 'all' && requestedBranchId !== context.branchId) {
        throw new ApiError(403, 'FORBIDDEN', 'Accès interdit à cette succursale.');
      }
      effectiveBranchId = context.branchId;
    } else if (requestedBranchId && requestedBranchId !== 'all') {
      const [branchRow] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, requestedBranchId), eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
        .limit(1);
      if (!branchRow) {
        throw new ApiError(403, 'FORBIDDEN', 'Succursale introuvable ou non autorisée.');
      }
      effectiveBranchId = branchRow.id;
    }

    // Branch filter conditions for Drizzle queries
    // Finance branch-scope rule (documented decision): money follows the
    // STUDENT's current branch (payments/invoices join user.branchId), not the
    // branch that issued the document. After a transfer, a student's billing
    // history reports under their new campus. This matches how the director
    // reads the school (who is this family's responsibility today?) at the
    // cost of moving history across campuses on transfer.
    const userBranchFilter = effectiveBranchId ? eq(user.branchId, effectiveBranchId) : undefined;
    const classBranchFilter = effectiveBranchId ? eq(classes.branchId, effectiveBranchId) : undefined;

    // =========================================================================
    // 2. Fetch Institutional Context (School, Branches, Session Year)
    // =========================================================================
    const [
      tenantRows,
      availableBranches,
      activeSessionYearRows,
    ] = await Promise.all([
      db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      db.select({
        id: branches.id,
        name: branches.name,
        code: branches.code,
        isDefault: branches.isDefault,
      }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true))),
      db.select({
        id: sessionYears.id,
        name: sessionYears.name,
        startDate: sessionYears.startDate,
        endDate: sessionYears.endDate,
        isDefault: sessionYears.isDefault,
      })
        .from(sessionYears)
        .where(and(
          eq(sessionYears.tenantId, tenantId),
          or(
            eq(sessionYears.isDefault, true),
            and(lte(sessionYears.startDate, today), gte(sessionYears.endDate, today)),
          ),
        ))
        .orderBy(
          desc(sql`CASE WHEN ${sessionYears.startDate} <= ${today} AND ${sessionYears.endDate} >= ${today} THEN 1 ELSE 0 END`),
          desc(sessionYears.isDefault),
          desc(sessionYears.startDate),
        )
        .limit(1),
    ]);

    const schoolName = tenantRows[0]?.name ?? 'SchoolOS';
    const activeBranchName = effectiveBranchId
      ? availableBranches.find(b => b.id === effectiveBranchId)?.name ?? 'Succursale'
      : availableBranches.length > 1
        ? 'Toutes les succursales'
        : availableBranches[0]?.name ?? 'Campus Principal';

    const activeAcademicYear = activeSessionYearRows[0];
    const periodStart = activeAcademicYear?.startDate ?? `${currentYear}-01-01`;
    const periodEnd = activeAcademicYear?.endDate ?? `${currentYear}-12-31`;
    const periodLabel = activeAcademicYear?.name ?? `${currentYear}`;

    // =========================================================================
    // 3. Parallel Database Aggregates
    // =========================================================================
    const [
      activeStudentCountRows,
      newAdmissionsMonthRows,
      todayAttendanceStatusRows,
      monthInvoicedRows,
      monthCollectedRows,
      activeClassesRows,
      activeClassSectionsRows,
      completedTodaySectionsRows,
      unjustifiedAbsencesTodayRows,
      overdueInvoicesRows,
      periodInvoicesByMonth,
      periodPaymentsByMonth,
      distributionRows,
      recentPaymentsRaw,
      absenceRiskRows,
      overdueRiskRows,
      todayBirthdaysRows,
      calendarEventRows,
      weeklyAttendanceRows,
      classesAttendanceRows,
      scheduledDaysRows,
    ] = await Promise.all([
      // 3.1 Active Students Count (Authoritative Rule: role='student' AND userStatus='active')
      db.select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
          userBranchFilter,
        )),

      // 3.2 New Registrations this month (Authoritative source: user.createdAt represents registration timestamp in SchoolOS)
      db.select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
          gte(user.createdAt, monthStart),
          userBranchFilter,
        )),

      // 3.3 Today's attendance marks (present, absent, late, etc. — voided rows
      // are audit history and never count toward today's pulse or trend)
      db.select({
        status: attendance.status,
        count: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.date, today),
          eq(attendance.isVoided, false),
          userBranchFilter,
        ))
        .groupBy(attendance.status),

      // 3.4 Invoiced this month (issued invoices only: pending/partial/overdue/paid —
      // drafts were never billed; cancelled and credited are no longer owed)
      db.select({ total: sql<string>`coalesce(sum(${invoices.netAmount}), 0)::numeric::text` })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.issueDate, monthStart),
          invoicedInvoiceCondition(invoices.status),
          userBranchFilter,
        )),

      // 3.5 Collected this month (posted payments net of approved partial refunds)
      db.select({ total: netCollectedSumSql(payments) })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(payments.tenantId, tenantId),
          gte(payments.paymentDate, monthStart),
          collectedPaymentCondition(payments.status),
          userBranchFilter,
        )),

      // 3.6 Active classes count
      db.select({ count: sql<number>`count(*)::int` })
        .from(classes)
        .where(and(
          eq(classes.tenantId, tenantId),
          classBranchFilter,
        )),

      // 3.7 Active class sections count (expected classes for attendance)
      db.select({ count: sql<number>`count(*)::int` })
        .from(classSections)
        .innerJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
        .where(and(
          eq(classSections.tenantId, tenantId),
          classBranchFilter,
        )),

      // 3.8 Distinct class sections with submitted attendance today
      db.select({ count: sql<number>`count(distinct ${user.classSectionId})::int` })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.date, today),
          eq(attendance.isVoided, false),
          userBranchFilter,
        )),

      // 3.9 Today's Unjustified Absences (Absent WITHOUT an approved excuse
      // covering the mark's EXACT scope — period/section when the excuse
      // carries them; voided rows never count)
      db.select({
        studentId: attendance.studentId,
        studentName: user.name,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .leftJoin(
          attendanceExcuses,
          and(
            eq(attendanceExcuses.tenantId, tenantId),
            eq(attendanceExcuses.studentId, attendance.studentId),
            eq(attendanceExcuses.status, 'approved'),
            eq(attendanceExcuses.date, today),
            or(isNull(attendanceExcuses.classSectionId), eq(attendanceExcuses.classSectionId, attendance.classSectionId))!,
            or(isNull(attendanceExcuses.period), eq(attendanceExcuses.period, attendance.period))!,
          ),
        )
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.date, today),
          eq(attendance.status, 'absent'),
          eq(attendance.isVoided, false),
          isNull(attendanceExcuses.id),
          userBranchFilter,
        )),

      // 3.10 Overdue Invoices (still owed AND past due date — credited/cancelled/draft invoices are never chased)
      db.select({
        id: invoices.id,
        studentId: invoices.studentId,
        remainingAmount: sql<string>`(${invoices.netAmount} - ${invoices.paidAmount})::numeric::text`,
        dueDate: invoices.dueDate,
        guardianPhone: user.guardianPhone,
        guardianName: user.guardianName,
      })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          overdueInvoiceCondition(invoices.status, invoices.dueDate, today),
          userBranchFilter,
        )),

      // 3.11 Financial breakdown by month across configured period (Invoiced — issued invoices only)
      db.select({
        monthNum: sql<number>`extract(month from date(${invoices.issueDate}))::int`,
        yearNum: sql<number>`extract(year from date(${invoices.issueDate}))::int`,
        monthLabel: sql<string>`to_char(date(${invoices.issueDate}), 'Mon')`,
        invoiced: sql<string>`coalesce(sum(${invoices.netAmount}), 0)::numeric::text`,
      })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd),
          invoicedInvoiceCondition(invoices.status),
          userBranchFilter,
        ))
        .groupBy(
          sql`extract(year from date(${invoices.issueDate}))::int`,
          sql`extract(month from date(${invoices.issueDate}))::int`,
          sql`to_char(date(${invoices.issueDate}), 'Mon')`,
        )
        .orderBy(
          sql`extract(year from date(${invoices.issueDate}))::int`,
          sql`extract(month from date(${invoices.issueDate}))::int`,
        ),

      // 3.12 Financial breakdown by month across configured period (Collected — posted payments only)
      db.select({
        monthNum: sql<number>`extract(month from date(${payments.paymentDate}))::int`,
        yearNum: sql<number>`extract(year from date(${payments.paymentDate}))::int`,
        collected: netCollectedSumSql(payments),
      })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(payments.tenantId, tenantId),
          gte(payments.paymentDate, periodStart),
          lte(payments.paymentDate, periodEnd),
          collectedPaymentCondition(payments.status),
          userBranchFilter,
        ))
        .groupBy(
          sql`extract(year from date(${payments.paymentDate}))::int`,
          sql`extract(month from date(${payments.paymentDate}))::int`,
        )
        .orderBy(
          sql`extract(year from date(${payments.paymentDate}))::int`,
          sql`extract(month from date(${payments.paymentDate}))::int`,
        ),

      // 3.13 Level distribution (P1 Reconciliation Invariant: includes 'Sans niveau')
      db.select({
        className: sql<string>`coalesce(${classes.name}, 'Sans niveau')`,
        count: sql<number>`count(*)::int`,
      })
        .from(user)
        .leftJoin(classSections, and(eq(user.classSectionId, classSections.id), eq(classSections.tenantId, tenantId)))
        .leftJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
          userBranchFilter,
        ))
        .groupBy(sql`coalesce(${classes.name}, 'Sans niveau')`),

      // 3.14 Bounded Recent Payments (Top 5 posted — refunds/reversals are not receipts)
      db.select({
        id: payments.id,
        studentId: payments.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        invoiceId: payments.invoiceId,
      })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(payments.tenantId, tenantId),
          collectedPaymentCondition(payments.status),
          userBranchFilter,
        ))
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
        .limit(5),

      // 3.15 Watchlist Candidate 1: Unjustified absences in last 30 days
      // (canonical: voided excluded, approved excuses reconciled at exact scope)
      db.select({
        studentId: attendance.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
        absentCount: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.status, 'absent'),
          eq(attendance.isVoided, false),
          gte(attendance.date, thirtyDaysAgo),
          eq(user.userStatus, 'active'),
          userBranchFilter,
          sql`NOT EXISTS (
            SELECT 1 FROM attendance_excuses ex
            WHERE ex.tenant_id = ${attendance.tenantId}
              AND ex.student_id = ${attendance.studentId}
              AND ex.date = ${attendance.date}
              AND ex.status = 'approved'
              AND (ex.class_section_id IS NULL OR ex.class_section_id = ${attendance.classSectionId})
              AND (ex.period IS NULL OR ex.period = ${attendance.period})
          )`,
        ))
        .groupBy(attendance.studentId, user.name, user.classSectionId)
        .having(sql`count(*) >= 2`),

      // 3.16 Watchlist Candidate 2: Overdue invoices by student (still owed AND past due date)
      db.select({
        studentId: invoices.studentId,
        studentName: user.name,
        classSectionId: user.classSectionId,
        overdueCount: sql<number>`count(*)::int`,
        overdueTotal: sql<string>`sum(${invoices.netAmount} - ${invoices.paidAmount})::numeric::text`,
        oldestDays: sql<number>`max(current_date - date(${invoices.dueDate}))::int`,
      })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          overdueInvoiceCondition(invoices.status, invoices.dueDate, today),
          eq(user.userStatus, 'active'),
          userBranchFilter,
        ))
        .groupBy(invoices.studentId, user.name, user.classSectionId),

      // 3.17 Birthdays Today (Data Minimization: SQL filtered by MM-DD)
      db.select({
        id: user.id,
        name: user.name,
        role: user.role,
      })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.userStatus, 'active'),
          sql`to_char(date(${user.dateOfBirth}), 'MM-DD') = to_char(date(${today}), 'MM-DD')`,
          userBranchFilter,
        ))
        .limit(10),

      // 3.18 Upcoming published calendar events (next 7 days)
      db.select({
        id: eventOccurrences.id,
        title: events.title,
        startTime: eventOccurrences.startTime,
        endTime: eventOccurrences.endTime,
        eventType: events.eventType,
      })
        .from(eventOccurrences)
        .innerJoin(eventSchedules, eq(eventOccurrences.scheduleId, eventSchedules.id))
        .innerJoin(events, eq(eventSchedules.eventId, events.id))
        .where(and(
          eq(events.tenantId, tenantId),
          eq(events.lifecycle, 'published'),
          gte(eventOccurrences.startTime, `${today}T00:00:00`),
          lte(eventOccurrences.startTime, `${new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}T23:59:59`),
        ))
        .orderBy(eventOccurrences.startTime)
        .limit(6),

      // 3.19 Attendance past 7 days (Weekly trend — voided rows excluded)
      db.select({
        date: attendance.date,
        status: attendance.status,
        count: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.isVoided, false),
          gte(attendance.date, new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),
          userBranchFilter,
        ))
        .groupBy(attendance.date, attendance.status),

      // 3.20 Classes with low attendance (< 85%) past 7 days (canonical
      // presence: present + late + excused; voided excluded)
      db.select({
        classSectionId: user.classSectionId,
        attended: sql<number>`sum(case when ${attendance.status} in ('present', 'late', 'excused') then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.isVoided, false),
          gte(attendance.date, new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),
          userBranchFilter,
        ))
        .groupBy(user.classSectionId)
        .having(sql`count(*) >= 1 and (sum(case when ${attendance.status} in ('present', 'late', 'excused') then 1 else 0 end)::float / count(*)::float) < 0.85`),

      // 3.21 Active schedule days (to know which weekdays have scheduled classes according to the timetable)
      db.selectDistinct({ dayOfWeek: classScheduleSlots.dayOfWeek })
        .from(classScheduleSlots)
        .where(eq(classScheduleSlots.tenantId, tenantId)),
    ]);

    // =========================================================================
    // 4. Resolve Class Names Map for Payments & Watchlist
    // =========================================================================
    const neededSectionIds = [...new Set([
      ...recentPaymentsRaw.map(r => r.classSectionId),
      ...absenceRiskRows.map(r => r.classSectionId),
      ...overdueRiskRows.map(r => r.classSectionId),
    ].filter((v): v is string => Boolean(v)))];

    const classSectionNames = new Map<string, string>();
    if (neededSectionIds.length > 0) {
      const sectionRows = await db
        .select({
          id: classSections.id,
          className: classes.name,
          sectionName: sections.name,
        })
        .from(classSections)
        .innerJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
        .innerJoin(sections, and(eq(classSections.sectionId, sections.id), eq(sections.tenantId, tenantId)))
        .where(and(
          eq(classSections.tenantId, tenantId),
          inArray(classSections.id, neededSectionIds),
        ));
      for (const row of sectionRows) {
        classSectionNames.set(row.id, `${row.className} ${row.sectionName}`.trim());
      }
    }
    const formatClassName = (id: string | null) => (id ? classSectionNames.get(id) ?? '—' : '—');

    // =========================================================================
    // 5. Compute Decision-First Action Center Metrics
    // =========================================================================
    const expectedClasses = activeClassSectionsRows[0]?.count ?? activeClassesRows[0]?.count ?? 0;
    const completedAttendanceClasses = completedTodaySectionsRows[0]?.count ?? 0;
    const missingAttendanceClasses = Math.max(0, expectedClasses - completedAttendanceClasses);

    // Day of week check: 0 is Sunday
    const isSunday = new Date().getDay() === 0;
    const isHoliday = calendarEventRows.some(e => e.eventType === 'holiday' || e.eventType === 'vacation');
    const isSchoolDay = !isSunday && !isHoliday;

    let actionCenterAttendanceStatus: 'no_school' | 'all_clear' | 'warning';
    let actionCenterAttendanceTitle: string;
    let actionCenterAttendanceSub: string;

    if (!isSchoolDay) {
      actionCenterAttendanceStatus = 'no_school';
      actionCenterAttendanceTitle = 'Aucun cours prévu aujourd\'hui';
      actionCenterAttendanceSub = isSunday ? 'Dimanche — Journée de repos' : 'Vacances scolaires / Jour férié';
    } else if (missingAttendanceClasses === 0 && expectedClasses > 0) {
      actionCenterAttendanceStatus = 'all_clear';
      actionCenterAttendanceTitle = 'Présences à jour';
      actionCenterAttendanceSub = `${completedAttendanceClasses} classes pointées sur ${expectedClasses}`;
    } else if (expectedClasses === 0) {
      actionCenterAttendanceStatus = 'all_clear';
      actionCenterAttendanceTitle = 'Aucune classe configurée';
      actionCenterAttendanceSub = 'Configurez les classes dans le module Académique';
    } else {
      actionCenterAttendanceStatus = 'warning';
      actionCenterAttendanceTitle = `${missingAttendanceClasses} présence${missingAttendanceClasses > 1 ? 's' : ''} non saisie${missingAttendanceClasses > 1 ? 's' : ''}`;
      actionCenterAttendanceSub = `${missingAttendanceClasses} classe${missingAttendanceClasses > 1 ? 's' : ''} terminée${missingAttendanceClasses > 1 ? 's' : ''} sans pointage`;
    }

    // Overdue Invoices
    const overdueCount = overdueInvoicesRows.length;
    const overdueAmount = overdueInvoicesRows.reduce((sum, r) => sum + Math.max(0, Number(r.remainingAmount)), 0);
    const affectedFamilies = new Set(overdueInvoicesRows.map(r => r.guardianPhone || r.guardianName || r.studentId)).size;
    const oldestOverdueDays = overdueInvoicesRows.length > 0
      ? Math.max(...overdueInvoicesRows.map(r => Math.max(0, Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86400000))))
      : 0;

    const actionCenterOverdue = {
      status: overdueCount > 0 ? ('warning' as const) : ('all_clear' as const),
      title: overdueCount > 0 ? `${overdueCount} factures en retard` : 'Paiements à jour',
      sub: overdueCount > 0
        ? `${formatMad(overdueAmount)} à recouvrer · ${affectedFamilies} famille${affectedFamilies > 1 ? 's' : ''}`
        : 'Aucun retard de paiement constaté',
      overdueCount,
      overdueAmount,
      affectedFamilies,
      oldestOverdueDays,
      route: '/dashboard/finance/invoices',
    };

    // Unjustified Absences
    const unjustifiedCount = unjustifiedAbsencesTodayRows.length;
    const unjustifiedStudentsCount = new Set(unjustifiedAbsencesTodayRows.map(r => r.studentId)).size;
    const actionCenterAbsences = {
      status: unjustifiedCount > 0 ? ('warning' as const) : ('all_clear' as const),
      title: unjustifiedCount > 0 ? `${unjustifiedCount} absence${unjustifiedCount > 1 ? 's' : ''} non justifiée${unjustifiedCount > 1 ? 's' : ''}` : 'Aucune absence injustifiée',
      sub: unjustifiedCount > 0 ? `${unjustifiedStudentsCount} élève${unjustifiedStudentsCount > 1 ? 's' : ''} concerné${unjustifiedStudentsCount > 1 ? 's' : ''}` : 'Toutes les absences du jour sont justifiées',
      unjustifiedCount,
      affectedStudentCount: unjustifiedStudentsCount,
      route: '/dashboard/attendance',
    };

    const actionCenter: ActionCenterData = {
      attendance: {
        status: actionCenterAttendanceStatus,
        title: actionCenterAttendanceTitle,
        sub: actionCenterAttendanceSub,
        expectedClasses,
        completedAttendanceClasses,
        missingAttendanceClasses,
        route: '/dashboard/attendance',
      },
      overdueInvoices: actionCenterOverdue,
      unjustifiedAbsences: actionCenterAbsences,
    };

    // =========================================================================
    // 6. Compute Four Daily Pulse KPIs
    // =========================================================================
    const activeStudentCount = activeStudentCountRows[0]?.count ?? 0;
    const newRegistrationsThisMonth = newAdmissionsMonthRows[0]?.count ?? 0;

    const presentMarks = todayAttendanceStatusRows.find(r => r.status === 'present')?.count ?? 0;
    const totalMarks = todayAttendanceStatusRows.reduce((sum, r) => sum + r.count, 0);
    // CANONICAL PRESENCE (Phase 7B): present + late + excused count as attended;
    // NULL (never 100) when no marks exist for today.
    const attendedMarks = todayAttendanceStatusRows
      .filter(r => r.status === 'present' || r.status === 'late' || r.status === 'excused')
      .reduce((sum, r) => sum + r.count, 0);
    const todayAttendanceRate = totalMarks > 0 ? Math.round((attendedMarks / totalMarks) * 1000) / 10 : null;

    const monthInvoiced = Number(monthInvoicedRows[0]?.total ?? 0);
    const monthCollected = Number(monthCollectedRows[0]?.total ?? 0);
    const monthRate = monthInvoiced > 0 ? Math.round((monthCollected / monthInvoiced) * 100) : null;

    const dailyPulse: DailyPulseData = {
      activeStudents: {
        count: activeStudentCount,
        newRegistrationsThisMonth,
      },
      attendanceToday: {
        rate: todayAttendanceRate,
        presentCount: presentMarks,
        markedCount: totalMarks,
        status: actionCenterAttendanceStatus,
      },
      periodCollected: {
        amount: monthCollected,
        rate: monthRate,
        periodInvoiced: monthInvoiced,
      },
      periodOverdue: {
        amount: overdueAmount,
        invoiceCount: overdueCount,
        familiesCount: affectedFamilies,
      },
    };

    // =========================================================================
    // 7. Compute Reconciled Finance Overview (Configured Academic Period)
    // =========================================================================
    const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const invoicedByMonthMap = new Map<string, number>();
    for (const row of periodInvoicesByMonth) {
      invoicedByMonthMap.set(`${row.yearNum}-${row.monthNum}`, Number(row.invoiced));
    }
    const collectedByMonthMap = new Map<string, number>();
    for (const row of periodPaymentsByMonth) {
      collectedByMonthMap.set(`${row.yearNum}-${row.monthNum}`, Number(row.collected));
    }

    // Generate month buckets between periodStart and periodEnd
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const monthlyBreakdown: FinanceMonthlyBreakdown[] = [];

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const key = `${y}-${m}`;
      const inv = invoicedByMonthMap.get(key) ?? 0;
      const col = collectedByMonthMap.get(key) ?? 0;
      monthlyBreakdown.push({
        month: MONTH_NAMES[m - 1] ?? '',
        monthNum: m,
        yearNum: y,
        invoiced: inv,
        collected: col,
        remaining: Math.max(0, inv - col),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Mathematical reconciliation: sum of breakdown exactly equals period totals
    const periodInvoicedTotal = monthlyBreakdown.reduce((sum, m) => sum + m.invoiced, 0);
    const periodCollectedTotal = monthlyBreakdown.reduce((sum, m) => sum + m.collected, 0);
    const periodOutstandingTotal = Math.max(0, periodInvoicedTotal - periodCollectedTotal);
    const collectionRate = periodInvoicedTotal > 0
      ? Math.round((periodCollectedTotal / periodInvoicedTotal) * 1000) / 10
      : 0;

    // Runtime reconciliation assertion:
    // When recent valid payments fall within [periodStart, periodEnd], their sum must not exceed periodCollectedTotal
    const validPaymentsInPeriodSum = recentPaymentsRaw
      .filter(p => p.paymentDate >= periodStart && p.paymentDate <= periodEnd)
      .reduce((sum, p) => sum + p.amount, 0);
    if (validPaymentsInPeriodSum > periodCollectedTotal + 0.01) {
      console.warn(`[Finance Reconciliation] Sum of recent payments (${validPaymentsInPeriodSum}) exceeds period collected total (${periodCollectedTotal}) for period ${periodLabel}`);
    }

    const financeOverview: FinanceOverviewData = {
      periodLabel,
      invoiced: periodInvoicedTotal,
      collected: periodCollectedTotal,
      outstanding: periodOutstandingTotal,
      collectionRate,
      monthlyBreakdown,
    };

    // =========================================================================
    // 8. Compute Attendance Trend (Instructional Days, No Fake Staff)
    // =========================================================================
    const attendanceByDate = new Map<string, { attended: number; total: number }>();
    for (const row of weeklyAttendanceRows) {
      const entry = attendanceByDate.get(row.date) ?? { attended: 0, total: 0 };
      entry.total += row.count;
      // CANONICAL PRESENCE: present + late + excused are attended.
      if (row.status === 'present' || row.status === 'late' || row.status === 'excused') {
        entry.attended += row.count;
      }
      attendanceByDate.set(row.date, entry);
    }

    const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const DOW_INDEX_TO_NAME: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };

    const scheduledDaysSet = new Set(scheduledDaysRows.map(r => r.dayOfWeek));
    const hasConfiguredSchedule = scheduledDaysSet.size > 0;

    const trendDays = Array.from({ length: 6 }, (_, i) => {
      // Show instructional days for past week
      const d = new Date(Date.now() - (5 - i) * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dayIndex = d.getDay();
      const dayName = DOW_INDEX_TO_NAME[dayIndex];
      const isDateHoliday = calendarEventRows.some((e) => {
        const evDate = e.startTime.slice(0, 10);
        return evDate === iso && (e.eventType === 'holiday' || e.eventType === 'vacation');
      });

      // Non-instructional if calendar holiday or if weekday has no scheduled classes (or Sunday if no schedule defined)
      const isNonInstructional = isDateHoliday || (hasConfiguredSchedule ? !scheduledDaysSet.has(dayName as any) : dayIndex === 0);

      const entry = attendanceByDate.get(iso);
      const sRate = entry && entry.total > 0 ? Math.round((entry.attended / entry.total) * 1000) / 10 : null;
      return {
        dayLabel: DAY_LABELS[dayIndex] ?? '',
        date: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
        studentRate: sRate,
        isToday: iso === today,
        isNonInstructional,
      };
    });

    const ratesWithData = trendDays.map(d => d.studentRate).filter((r): r is number => r !== null);
    const weeklyAverageRate = ratesWithData.length > 0
      ? Math.round((ratesWithData.reduce((sum, r) => sum + r, 0) / ratesWithData.length) * 10) / 10
      : null;

    const daysBelowThresholdCount = trendDays.filter(d => d.studentRate !== null && d.studentRate < 85).length;

    const attendanceTrend: AttendanceTrendData = {
      weeklyAverageRate,
      days: trendDays,
      classesBelowThresholdCount: classesAttendanceRows.length,
      daysBelowThresholdCount,
      thresholdPercent: 85,
    };

    // =========================================================================
    // 9. Upcoming Events & Birthdays
    // =========================================================================
    const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const upcomingEvents: UpcomingEventItem[] = calendarEventRows.map((ev) => {
      const dateStr = ev.startTime.slice(0, 10);
      let timingGroup: UpcomingEventItem['timingGroup'] = 'this_week';
      if (dateStr === today) {
        timingGroup = 'today';
      } else if (dateStr === tomorrowIso) {
        timingGroup = 'tomorrow';
      }

      return {
        id: ev.id,
        title: ev.title,
        startDate: dateStr,
        timingGroup,
      };
    });

    // =========================================================================
    // 10. Bounded Recent Payments (5 Records)
    // =========================================================================
    const recentPayments: RecentPaymentItem[] = recentPaymentsRaw.map(p => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.studentName,
      className: formatClassName(p.classSectionId),
      amount: p.amount,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod ?? 'Espèces',
      reason: 'Frais de scolarité',
      invoiceId: p.invoiceId,
    }));

    // =========================================================================
    // 11. Watchlist (Bounded Top 5 Priority Cases + Total Count)
    // =========================================================================
    const watchlistMap = new Map<string, WatchlistStudent>();

    for (const r of absenceRiskRows) {
      watchlistMap.set(r.studentId, {
        id: `att-${r.studentId}`,
        studentId: r.studentId,
        name: r.studentName,
        className: formatClassName(r.classSectionId),
        reason: `${r.absentCount} absences non justifiées`,
        category: 'attendance',
        severity: r.absentCount >= 4 ? 'critical' : 'warning',
        relevantMetric: `${r.absentCount} abs.`,
        destinationRoute: `/dashboard/attendance?studentId=${r.studentId}`,
      });
    }

    for (const r of overdueRiskRows) {
      const existing = watchlistMap.get(r.studentId);
      if (existing) {
        existing.reason = `${existing.reason} · Retard paiement (${r.oldestDays ?? 0}j)`;
        existing.severity = 'critical';
      } else {
        watchlistMap.set(r.studentId, {
          id: `fin-${r.studentId}`,
          studentId: r.studentId,
          name: r.studentName,
          className: formatClassName(r.classSectionId),
          reason: `Paiement en retard · ${r.oldestDays ?? 0} jours`,
          category: 'finance',
          severity: (r.oldestDays ?? 0) > 30 ? 'critical' : 'warning',
          relevantMetric: formatMad(Number(r.overdueTotal ?? 0)),
          destinationRoute: `/dashboard/finance/invoices?studentId=${r.studentId}`,
        });
      }
    }

    const allWatchlist = [...watchlistMap.values()].sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') {
        return -1;
      }
      if (b.severity === 'critical' && a.severity !== 'critical') {
        return 1;
      }
      return 0;
    });

    const totalWatchlistCount = allWatchlist.length;
    const boundedWatchlist = allWatchlist.slice(0, 5);

    // =========================================================================
    // 12. Student Distribution Invariant: SUM(buckets) === activeStudentCount
    // =========================================================================
    const studentDistributionItems: StudentDistributionItem[] = distributionRows
      .map(r => ({ name: r.className, count: r.count }))
      .sort((a, b) => b.count - a.count);

    // Double-check mathematical invariant
    const sumBuckets = studentDistributionItems.reduce((sum, item) => sum + item.count, 0);
    if (sumBuckets !== activeStudentCount && activeStudentCount > 0) {
      // If discrepancy exists, balance into 'Sans niveau' to prevent silent data drop
      const diff = activeStudentCount - sumBuckets;
      const unassigned = studentDistributionItems.find(i => i.name === 'Sans niveau');
      if (unassigned) {
        unassigned.count += diff;
      } else {
        studentDistributionItems.push({ name: 'Sans niveau', count: diff });
      }
    }

    // =========================================================================
    // 13. Construct Complete Dashboard Payload
    // =========================================================================
    const payload: FullDashboardSummary = {
      institution: {
        name: schoolName,
        activeBranchName,
        activeBranchId: effectiveBranchId,
        availableBranches,
        currentDateFormatted: new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      actionCenter,
      dailyPulse,
      financeOverview,
      attendanceTrend,
      upcomingEvents: {
        events: upcomingEvents,
        todayBirthdaysCount: todayBirthdaysRows.length,
        birthdaysPreview: todayBirthdaysRows.slice(0, 3).map(b => b.name),
      },
      recentPayments,
      watchlist: {
        students: boundedWatchlist,
        totalWatchlistCount,
      },
      studentDistribution: {
        items: studentDistributionItems,
        totalActiveStudents: activeStudentCount,
      },
    };

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
