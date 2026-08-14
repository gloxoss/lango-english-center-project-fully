import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  classScheduleSlots, classes, classSections, classSubjects, guardianStudents,
  guardians, inquiries, invoices, sections, sessionYears, subjects, timetableVersions,
  user,
} from '@/models/Schema';
import { guardIncidents, guardVisits } from '@/features/guard/models/guard-schema';

// ---------------------------------------------------------------------------
// Shared portal home — role-scoped widgets + real, tenant-scoped aggregates.
// The `widgets` array mirrors the manifest's homeWidgets so the two contracts
// agree (enforced by an agreement test). Every branch is tenant-scoped and
// relationship-scoped; a failing branch degrades to { degraded: true } rather
// than leaking or erroring the whole request.
// ---------------------------------------------------------------------------

const DAY_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const HOME_WIDGETS: Record<string, string[]> = {
  school_admin: ['stats-overview', 'recent-activity', 'quick-actions'],
  super_admin: ['stats-overview', 'recent-activity', 'quick-actions'],
  teacher: ['my-classes', 'today-schedule', 'pending-attendance'],
  student: ['my-schedule', 'my-grades', 'my-attendance'],
  alumni: ['my-schedule', 'alumni-activity'],
  parent: ['children-overview', 'attendance-summary', 'payment-status'],
  accountant: ['finance-overview', 'pending-payments', 'recent-transactions', 'payroll-summary'],
  receptionist: ['inquiry-intake', 'visitor-log', 'appointments'],
  guard: ['today-visits', 'open-incidents'],
  librarian: ['overdue-books', 'new-acquisitions'],
};

export async function getPortalHome(ctx: RequestContext) {
  const widgets = HOME_WIDGETS[ctx.role] ?? [];

  if (ctx.role === 'super_admin' || !ctx.tenantId) {
    return { role: ctx.role, baseRole: ctx.baseRole, widgets, data: {} };
  }

  const tenantId = ctx.tenantId;
  let data: Record<string, unknown> = {};
  try {
    switch (ctx.role) {
      case 'school_admin':
        data = await schoolAdminHome(tenantId);
        break;
      case 'accountant':
        data = await accountantHome(tenantId);
        break;
      case 'teacher':
        data = await teacherHome(tenantId, ctx.userId);
        break;
      case 'student':
      case 'alumni':
        data = await studentHome(tenantId, ctx.userId);
        break;
      case 'parent':
        data = await parentHome(tenantId, ctx.userId);
        break;
      case 'receptionist':
        data = await receptionistHome(tenantId);
        break;
      case 'guard':
        data = await guardHome(tenantId);
        break;
      default:
        data = {};
    }
  } catch (err) {
    console.error('Portal home aggregate failed', { role: ctx.role, err });
    data = { degraded: true };
  }

  return { role: ctx.role, baseRole: ctx.baseRole, widgets, data };
}

async function schoolAdminHome(tenantId: string) {
  const [studentsCount, teachersCount, pendingInvoices] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher'))),
    db
      .select({
        n: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.paidAmount}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.status} in ('pending', 'overdue', 'partial')`)),
  ]);

  return {
    studentsCount: Number(studentsCount?.[0]?.n ?? 0),
    teachersCount: Number(teachersCount?.[0]?.n ?? 0),
    pendingInvoicesCount: Number(pendingInvoices?.[0]?.n ?? 0),
    pendingInvoicesTotal: Number(pendingInvoices?.[0]?.total ?? 0),
  };
}

async function accountantHome(tenantId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [paymentsToday, overdue] = await Promise.all([
    db
      .select({
        totalCash: sql<number>`coalesce(sum(case when ${invoices.status} = 'paid' then 1 else 0 end), 0)`,
        totalCount: sql<number>`count(*)`,
      })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId)),
    db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`coalesce(sum(${invoices.amount} - ${invoices.paidAmount}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.status} in ('pending', 'overdue', 'partial')`)),
  ]);

  return {
    totalInvoicesCount: Number(paymentsToday?.[0]?.totalCount ?? 0),
    pendingOverdueInvoicesCount: Number(overdue?.[0]?.count ?? 0),
    pendingOverdueTotalAmount: Number(overdue?.[0]?.totalAmount ?? 0),
    asOf: today,
  };
}

async function teacherHome(tenantId: string, userId: string) {
  const todayName = DAY_OF_WEEK[new Date().getDay()]!;
  let todaySchedule: Array<{
    startTime: string;
    endTime: string;
    roomLabel: string | null;
    className: string;
    sectionName: string;
    subjectName: string;
  }> = [];

  const [defaultSession] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  if (defaultSession) {
    const [publishedVer] = await db
      .select({ id: timetableVersions.id })
      .from(timetableVersions)
      .where(and(
        eq(timetableVersions.tenantId, tenantId),
        eq(timetableVersions.sessionYearId, defaultSession.id),
        eq(timetableVersions.status, 'published'),
      ))
      .limit(1);

    if (publishedVer) {
      todaySchedule = await db
        .select({
          startTime: classScheduleSlots.startTime,
          endTime: classScheduleSlots.endTime,
          roomLabel: classScheduleSlots.roomLabel,
          className: classes.name,
          sectionName: sections.name,
          subjectName: subjects.name,
        })
        .from(classScheduleSlots)
        .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
        .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
        .where(and(
          eq(classScheduleSlots.tenantId, tenantId),
          eq(classScheduleSlots.versionId, publishedVer.id),
          eq(classScheduleSlots.teacherId, userId),
          eq(classScheduleSlots.dayOfWeek, todayName),
        ))
        .orderBy(classScheduleSlots.startTime);
    }
  }

  return { todaySchedule, todayName };
}

async function studentHome(tenantId: string, userId: string) {
  const [row] = await db
    .select({
      className: user.className,
      level: user.level,
      paymentStatus: user.paymentStatus,
    })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantId, tenantId)))
    .limit(1);

  return {
    className: row?.className ?? null,
    level: row?.level ?? null,
    paymentStatus: row?.paymentStatus ?? null,
  };
}

async function parentHome(tenantId: string, userId: string) {
  const now = new Date().toISOString();
  const children = await db
    .select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      className: user.className,
      level: user.level,
    })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .innerJoin(user, eq(user.id, guardianStudents.studentId))
    .where(and(
      eq(guardians.tenantId, tenantId),
      eq(guardians.userId, userId),
      eq(guardianStudents.tenantId, tenantId),
      eq(guardianStudents.status, 'active'),
      or(isNull(guardianStudents.effectiveFrom), lte(guardianStudents.effectiveFrom, now)),
      or(isNull(guardianStudents.effectiveTo), gt(guardianStudents.effectiveTo, now)),
      eq(user.tenantId, tenantId),
      eq(user.userStatus, 'active'),
    ))
    .limit(10);

  return { childrenCount: children.length, children };
}

async function receptionistHome(tenantId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [newInquiries, todayVisits] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(inquiries)
      .where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.status, 'new'))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardVisits)
      .where(and(eq(guardVisits.tenantId, tenantId), sql`date(${guardVisits.createdAt}) = ${today}::date`)),
  ]);

  return {
    openInquiriesCount: Number(newInquiries?.[0]?.n ?? 0),
    todayVisitsCount: Number(todayVisits?.[0]?.n ?? 0),
  };
}

async function guardHome(tenantId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [todayVisits, openIncidents] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardVisits)
      .where(and(eq(guardVisits.tenantId, tenantId), sql`date(${guardVisits.createdAt}) = ${today}::date`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardIncidents)
      .where(and(eq(guardIncidents.tenantId, tenantId), eq(guardIncidents.status, 'open'))),
  ]);

  return {
    todayVisitsCount: Number(todayVisits?.[0]?.n ?? 0),
    openIncidentsCount: Number(openIncidents?.[0]?.n ?? 0),
  };
}
