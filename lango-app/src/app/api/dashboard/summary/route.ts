import type {
  ActionCenterData,
  AdmissionsOverview,
  AttendanceDayPoint,
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
import { createTranslator } from 'next-intl';
import { NextResponse } from 'next/server';
import { eventOccurrences, events, eventSchedules } from '@/features/events/models/events-schema';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  collectedPaymentCondition,
  invoicedInvoiceCondition,
  netCollectedSumSql,
  overdueInvoiceCondition,
} from '@/libs/finance/definitions';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import {
  admissionInterviews,
  applicants,
  attendance,
  attendanceExcuses,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  invoices,
  payments,
  sections,
  tenants,
  user,
} from '@/models/Schema';
import messagesAr from '../../../../../locales/ar.json';
import messagesEn from '../../../../../locales/en.json';
import messagesFr from '../../../../../locales/fr.json';

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

// The dashboard asks for its UI locale (?locale=), so the sentences this route
// builds (action center, watchlist reasons, day labels) match the page language
// instead of always being French (audit S-37).
const SUMMARY_MESSAGES = { fr: messagesFr, en: messagesEn, ar: messagesAr } as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const requestedLocale = searchParams.get('locale');
    const locale: keyof typeof SUMMARY_MESSAGES = requestedLocale === 'ar' || requestedLocale === 'en' ? requestedLocale : 'fr';
    const tr = createTranslator({ locale, messages: SUMMARY_MESSAGES[locale], namespace: 'DashboardHome' });

    const today = todayIso();
    const monthStart = monthStartIso();
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); // 0-based
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // =========================================================================
    // 1. Authoritative Branch Scoping (P0 Security Invariant)
    // =========================================================================
    // The ONLY branch source is the server context: locked staff are confined
    // to their assigned campus, whole-school staff see their session's chosen
    // campus (persisted through POST /api/portal/branch) or all campuses. No
    // client-supplied branch parameter exists here — one that arrives is
    // ignored, never trusted.
    const effectiveBranchId: string | null = context.branchId;

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
      getCurrentSessionYear(tenantId),
    ]);

    const schoolName = tenantRows[0]?.name ?? 'SchoolOS';
    const activeBranchName = effectiveBranchId
      ? availableBranches.find(b => b.id === effectiveBranchId)?.name ?? tr('branchFallback')
      : availableBranches.length > 1
        ? tr('allBranches')
        : availableBranches[0]?.name ?? tr('mainCampus');

    // OD1: the current year is the flagged `is_default` row, never the one that
    // happens to contain today. Resolving it from the date made the dashboard
    // disagree with the other 26 consumers of `is_default` every September.
    const activeAcademicYear = activeSessionYearRows;
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
      prevMonthCollectedRows,
      weekStatusRows,
      sectionsMarkedByDateRows,
      weekUnjustifiedByStudentRows,
      applicantsRows,
      interviewsTodayRows,
      admissionsConvertedRows,
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
      // Collected this month (posted payments net of approved partial refunds)
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
        open: sql<string>`coalesce(sum(greatest(${invoices.netAmount} - ${invoices.paidAmount}, 0)), 0)::numeric::text`,
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

      // 3.20 Classes with low attendance (< 85%) past 7 days (PHYSICAL
      // presence: present + late; an excused absence is justified, not attended;
      // voided excluded)
      db.select({
        classSectionId: user.classSectionId,
        attended: sql<number>`sum(case when ${attendance.status} in ('present', 'late') then 1 else 0 end)::int`,
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
        .having(sql`count(*) >= 1 and (sum(case when ${attendance.status} in ('present', 'late') then 1 else 0 end)::float / count(*)::float) < 0.85`),

      // 3.21 Active schedule days (to know which weekdays have scheduled classes according to the timetable)
      db.selectDistinct({ dayOfWeek: classScheduleSlots.dayOfWeek })
        .from(classScheduleSlots)
        .where(eq(classScheduleSlots.tenantId, tenantId)),

      // 3.22 Previous calendar month collected (honest "vs mois précédent"
      // comparison for the cash-receipts KPI; never mixed with invoicing)
      db.select({ total: netCollectedSumSql(payments) })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(payments.tenantId, tenantId),
          gte(payments.paymentDate, new Date(currentYear, currentMonthIndex - 1, 1).toISOString().slice(0, 10)),
          lte(payments.paymentDate, new Date(currentYear, currentMonthIndex, 0).toISOString().slice(0, 10)),
          collectedPaymentCondition(payments.status),
          userBranchFilter,
        )),

      // 3.23 Week status counts (unjustified absences and late marks over the
      // last 7 days, voided excluded, excuses reconciled at exact scope)
      db.select({
        status: attendance.status,
        count: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.isVoided, false),
          gte(attendance.date, new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),
          inArray(attendance.status, ['absent', 'late']),
          userBranchFilter,
          sql`(${attendance.status} <> 'absent' OR NOT EXISTS (
            SELECT 1 FROM attendance_excuses ex
            WHERE ex.tenant_id = ${attendance.tenantId}
              AND ex.student_id = ${attendance.studentId}
              AND ex.date = ${attendance.date}
              AND ex.status = 'approved'
              AND (ex.class_section_id IS NULL OR ex.class_section_id = ${attendance.classSectionId})
              AND (ex.period IS NULL OR ex.period = ${attendance.period})
          ))`,
        ))
        .groupBy(attendance.status),

      // 3.24 Distinct class sections marked per day (last 6 days) - feeds the
      // per-day completion state of the weekly attendance panel
      db.select({
        date: attendance.date,
        sectionsMarked: sql<number>`count(distinct ${user.classSectionId})::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.isVoided, false),
          gte(attendance.date, new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),
          userBranchFilter,
        ))
        .groupBy(attendance.date),

      // 3.25 Unjustified absences this week per student (absenteeism panel)
      db.select({
        studentId: attendance.studentId,
        absentCount: sql<number>`count(*)::int`,
      })
        .from(attendance)
        .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.status, 'absent'),
          eq(attendance.isVoided, false),
          gte(attendance.date, new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)),
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
        .groupBy(attendance.studentId),

      // 3.26 Admissions queue (open applications only; branch-scoped.
      // NOTE: applicants carries its own branchId — no user join here.)
      db.select({
        id: applicants.id,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
        status: applicants.status,
        applicationDate: applicants.applicationDate,
      })
        .from(applicants)
        .where(and(
          eq(applicants.tenantId, tenantId),
          inArray(applicants.status, ['new', 'applied', 'contacted', 'qualified']),
          effectiveBranchId ? eq(applicants.branchId, effectiveBranchId) : undefined,
        ))
        .orderBy(desc(applicants.applicationDate))
        .limit(50),

      // 3.27 Admission interviews scheduled for today
      db.select({ count: sql<number>`count(*)::int` })
        .from(admissionInterviews)
        .where(and(
          eq(admissionInterviews.tenantId, tenantId),
          eq(admissionInterviews.status, 'scheduled'),
          gte(admissionInterviews.scheduledAt, `${today}T00:00:00`),
          lte(admissionInterviews.scheduledAt, `${today}T23:59:59`),
        )),

      // 3.28 Conversions this month (applications turned into students)
      db.select({ count: sql<number>`count(*)::int` })
        .from(applicants)
        .where(and(
          eq(applicants.tenantId, tenantId),
          eq(applicants.status, 'converted'),
          gte(applicants.applicationDate, monthStart),
          effectiveBranchId ? eq(applicants.branchId, effectiveBranchId) : undefined,
        )),
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
      actionCenterAttendanceTitle = tr('acNoSchoolTitle');
      actionCenterAttendanceSub = isSunday ? tr('acSundaySub') : tr('acHolidaySub');
    } else if (missingAttendanceClasses === 0 && expectedClasses > 0) {
      actionCenterAttendanceStatus = 'all_clear';
      actionCenterAttendanceTitle = tr('acAttendanceDoneTitle');
      actionCenterAttendanceSub = tr('acAttendanceDoneSub', { done: completedAttendanceClasses, expected: expectedClasses });
    } else if (expectedClasses === 0) {
      actionCenterAttendanceStatus = 'all_clear';
      actionCenterAttendanceTitle = tr('acNoClassesTitle');
      actionCenterAttendanceSub = tr('acNoClassesSub');
    } else {
      actionCenterAttendanceStatus = 'warning';
      actionCenterAttendanceTitle = tr('acAttendanceMissingTitle', { count: missingAttendanceClasses });
      actionCenterAttendanceSub = tr('acAttendanceMissingSub', { count: missingAttendanceClasses });
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
      title: overdueCount > 0 ? tr('acOverdueTitle', { count: overdueCount }) : tr('acPaymentsClearTitle'),
      sub: overdueCount > 0
        ? tr('acOverdueSub', { amount: formatMad(overdueAmount), families: affectedFamilies })
        : tr('acPaymentsClearSub'),
      overdueCount,
      overdueAmount,
      affectedFamilies,
      oldestOverdueDays,
      route: '/dashboard/finance/invoices',
    };

    // Unjustified Absences - business truth: while attendance marking is
    // incomplete the absence picture is UNKNOWN, so this card must never read
    // as a green "all clear" (ENH-ADMIN-DASH-01: it used to sit green next to
    // "12 classes terminées sans pointage").
    const unjustifiedCount = unjustifiedAbsencesTodayRows.length;
    const unjustifiedStudentsCount = new Set(unjustifiedAbsencesTodayRows.map(r => r.studentId)).size;
    const attendanceIncomplete = isSchoolDay && expectedClasses > 0 && missingAttendanceClasses > 0;
    const actionCenterAbsences = {
      status: attendanceIncomplete
        ? ('incomplete' as const)
        : unjustifiedCount > 0
          ? ('warning' as const)
          : ('all_clear' as const),
      title: attendanceIncomplete
        ? tr('acAssiduityPendingTitle')
        : unjustifiedCount > 0
          ? tr('acUnjustifiedTitle', { count: unjustifiedCount })
          : tr('acNoUnjustifiedTitle'),
      sub: attendanceIncomplete
        ? tr('acAssiduityPendingSub', { count: missingAttendanceClasses })
        : unjustifiedCount > 0
          ? tr('acUnjustifiedSub', { count: unjustifiedStudentsCount })
          : tr('acNoUnjustifiedSub'),
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
    // PHYSICAL PRESENCE: present + late are in the room. An excused absence is
    // justified, not attended; NULL (never 100) when no marks exist for today.
    const attendedMarks = todayAttendanceStatusRows
      .filter(r => r.status === 'present' || r.status === 'late')
      .reduce((sum, r) => sum + r.count, 0);
    const todayAttendanceRate = totalMarks > 0 ? Math.round((attendedMarks / totalMarks) * 1000) / 10 : null;

    const monthCollected = Number(monthCollectedRows[0]?.total ?? 0);
    const prevMonthCollected = Number(prevMonthCollectedRows[0]?.total ?? 0);

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
        expectedClasses,
        missingClasses: missingAttendanceClasses,
      },
      periodCollected: {
        amount: monthCollected,
        previousMonthCollected: prevMonthCollected,
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
    let periodOpenTotal = 0;
    for (const row of periodInvoicesByMonth) {
      invoicedByMonthMap.set(`${row.yearNum}-${row.monthNum}`, Number(row.invoiced));
      periodOpenTotal += Number(row.open ?? 0);
    }
    const collectedByMonthMap = new Map<string, number>();
    for (const row of periodPaymentsByMonth) {
      collectedByMonthMap.set(`${row.yearNum}-${row.monthNum}`, Number(row.collected));
    }

    // Generate month buckets between periodStart and periodEnd
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const monthlyBreakdown: FinanceMonthlyBreakdown[] = [];

    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const monthCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    for (let offset = 0; offset < monthCount; offset++) {
      const y = startYear + Math.floor((startMonth + offset) / 12);
      const m = ((startMonth + offset) % 12) + 1;
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
    }

    // Mathematical reconciliation: sum of breakdown exactly equals period totals
    const periodInvoicedTotal = monthlyBreakdown.reduce((sum, m) => sum + m.invoiced, 0);
    const periodCollectedTotal = monthlyBreakdown.reduce((sum, m) => sum + m.collected, 0);
    // Balances come from the period's invoices themselves (net - paid). Cash
    // received in the period also settles older invoices, so "invoiced minus
    // cash" read 0 due and a collection rate above 100% while families still
    // owed money on this year's invoices.
    const periodOutstandingTotal = periodOpenTotal;
    const periodPaidOnInvoices = Math.max(0, periodInvoicedTotal - periodOutstandingTotal);
    const collectionRate = periodInvoicedTotal > 0
      ? Math.round((periodPaidOnInvoices / periodInvoicedTotal) * 1000) / 10
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
      collected: periodPaidOnInvoices,
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
      // PHYSICAL PRESENCE: present + late are in the room.
      if (row.status === 'present' || row.status === 'late') {
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
    const sectionsMarkedByDate = new Map<string, number>();
    for (const row of sectionsMarkedByDateRows) {
      sectionsMarkedByDate.set(row.date, row.sectionsMarked);
    }

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
      const markedSections = sectionsMarkedByDate.get(iso) ?? 0;
      // Per-day business truth: a scheduled day with marks but fewer marked
      // sections than expected is 'incomplete'; with no marks at all it is
      // 'no_data' (pointage incomplet), never a fabricated dash.
      let completionState: AttendanceDayPoint['completionState'];
      if (isNonInstructional) {
        completionState = 'no_class';
      } else if (!entry || entry.total === 0) {
        completionState = 'no_data';
      } else if (expectedClasses > 0 && markedSections < expectedClasses) {
        completionState = 'incomplete';
      } else {
        completionState = 'complete';
      }
      return {
        dayLabel: DAY_LABELS[dayIndex] ? tr(`day_${dayIndex}` as 'day_0') : '',
        date: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
        studentRate: sRate,
        isToday: iso === today,
        isNonInstructional,
        completionState,
        sectionsMarked: markedSections,
        sectionsExpected: expectedClasses,
      };
    });

    const ratesWithData = trendDays.map(d => d.studentRate).filter((r): r is number => r !== null);
    const weeklyAverageRate = ratesWithData.length > 0
      ? Math.round((ratesWithData.reduce((sum, r) => sum + r, 0) / ratesWithData.length) * 10) / 10
      : null;

    const daysBelowThresholdCount = trendDays.filter(d => d.studentRate !== null && d.studentRate < 85).length;
    const weekUnjustifiedCount = weekStatusRows.find(r => r.status === 'absent')?.count ?? 0;
    const weekLateCount = weekStatusRows.find(r => r.status === 'late')?.count ?? 0;

    const attendanceTrend: AttendanceTrendData = {
      weeklyAverageRate,
      days: trendDays,
      classesBelowThresholdCount: classesAttendanceRows.length,
      daysBelowThresholdCount,
      thresholdPercent: 85,
      weekUnjustifiedCount,
      weekLateCount,
      todayMissingClasses: missingAttendanceClasses,
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
      paymentMethod: p.paymentMethod ?? 'cash',
      reason: tr('tuitionFees'),
      invoiceId: p.invoiceId,
    }));

    // =========================================================================
    // 11. Absenteeism Watchlist (Bounded Top 5 + Total Count)
    // =========================================================================
    const watchlistMap = new Map<string, WatchlistStudent>();
    const weekUnjustifiedByStudent = new Map<string, number>();
    for (const r of weekUnjustifiedByStudentRows) {
      weekUnjustifiedByStudent.set(r.studentId, r.absentCount);
    }

    for (const r of absenceRiskRows) {
      const weekCount = weekUnjustifiedByStudent.get(r.studentId) ?? 0;
      watchlistMap.set(r.studentId, {
        id: `att-${r.studentId}`,
        studentId: r.studentId,
        name: r.studentName,
        className: formatClassName(r.classSectionId),
        reason: tr('wlAbsences', { count: r.absentCount }),
        category: 'attendance',
        severity: r.absentCount >= 4 ? 'critical' : 'warning',
        relevantMetric: tr('wlAbsShort', { count: r.absentCount }),
        destinationRoute: `/dashboard/attendance?studentId=${r.studentId}`,
        unjustifiedWeek: weekCount,
        unjustifiedMonth: r.absentCount,
      });
    }

    for (const r of overdueRiskRows) {
      const existing = watchlistMap.get(r.studentId);
      if (existing) {
        existing.reason = `${existing.reason} · ${tr('wlLatePaymentShort', { days: r.oldestDays ?? 0 })}`;
        existing.severity = 'critical';
      } else {
        watchlistMap.set(r.studentId, {
          id: `fin-${r.studentId}`,
          studentId: r.studentId,
          name: r.studentName,
          className: formatClassName(r.classSectionId),
          reason: tr('wlLatePayment', { days: r.oldestDays ?? 0 }),
          category: 'finance',
          severity: (r.oldestDays ?? 0) > 30 ? 'critical' : 'warning',
          relevantMetric: formatMad(Number(r.overdueTotal ?? 0)),
          destinationRoute: `/dashboard/finance/invoices?studentId=${r.studentId}`,
        });
      }
    }

    // The daily panel is explicitly the ABSENTEEISM queue: overdue-invoice
    // cases have their own action card and the invoices console, and mixing
    // them here made the panel vague ("Élèves à surveiller").
    const absenteeismList = [...watchlistMap.values()]
      .filter(s => s.category === 'attendance')
      .sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') {
          return -1;
        }
        if (b.severity === 'critical' && a.severity !== 'critical') {
          return 1;
        }
        return (b.unjustifiedMonth ?? 0) - (a.unjustifiedMonth ?? 0);
      });

    const totalWatchlistCount = absenteeismList.length;
    const boundedWatchlist = absenteeismList.slice(0, 5);

    // =========================================================================
    // 11b. Admissions Queue Overview (actionable, branch-scoped)
    // =========================================================================
    const admissions: AdmissionsOverview = {
      toReview: applicantsRows.length,
      interviewsToday: interviewsTodayRows[0]?.count ?? 0,
      convertedThisMonth: admissionsConvertedRows[0]?.count ?? 0,
      recent: applicantsRows.slice(0, 4).map(a => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        status: a.status,
        programName: null,
        applicationDate: a.applicationDate,
      })),
    };

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
        currentDateFormatted: new Date().toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        branchScope: context.branchLocked ? 'pinned' : 'all',
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
      admissions,
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
