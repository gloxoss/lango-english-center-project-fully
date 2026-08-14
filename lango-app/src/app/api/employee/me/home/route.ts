import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classScheduleSlots, classes, classSections, classSubjects, employeeLeaveBalances,
  leaveCategories, payrollPeriods, payrollRunLines, payslips, sections,
  sessionYears, subjects, timetableVersions, user, workforcePunchEvents,
} from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

const DAY_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// GET /api/employee/me/home
// Aggregate: leave balance, latest payslip, current punch state, today's schedule.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const currentYear = new Date().getFullYear();

    // Leave balance summary (current year, all categories)
    const balanceRows = await db
      .select({
        categoryId: leaveCategories.id,
        categoryName: leaveCategories.name,
        daysPerYear: leaveCategories.daysPerYear,
        accruedDays: employeeLeaveBalances.accruedDays,
        usedDays: employeeLeaveBalances.usedDays,
      })
      .from(employeeLeaveBalances)
      .innerJoin(leaveCategories, eq(employeeLeaveBalances.categoryId, leaveCategories.id))
      .where(
        and(
          eq(employeeLeaveBalances.tenantId, tenantId),
          eq(employeeLeaveBalances.userId, ctx.userId),
          eq(employeeLeaveBalances.year, currentYear),
        ),
      );

    const leaveBalances = balanceRows.map(b => ({
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      daysPerYear: b.daysPerYear,
      accruedDays: Number(b.accruedDays),
      usedDays: Number(b.usedDays),
      remainingDays: Number(b.accruedDays) - Number(b.usedDays),
    }));
    const totalRemaining = leaveBalances.reduce((sum, b) => sum + b.remainingDays, 0);

    // Latest payslip (published snapshot)
    const [latestPayslip] = await db
      .select({
        id: payslips.id,
        issuedAt: payslips.issuedAt,
        year: payrollPeriods.year,
        month: payrollPeriods.month,
        grossSalary: payrollRunLines.grossSalary,
        netSalary: payrollRunLines.netSalary,
      })
      .from(payslips)
      .innerJoin(payrollPeriods, eq(payslips.periodId, payrollPeriods.id))
      .innerJoin(payrollRunLines, eq(payslips.runLineId, payrollRunLines.id))
      .where(and(eq(payslips.tenantId, tenantId), eq(payslips.userId, ctx.userId)))
      .orderBy(desc(payslips.issuedAt))
      .limit(1);

    // Current punch state (latest event; an open 'in' means currently clocked in)
    const [latestPunch] = await db
      .select({
        id: workforcePunchEvents.id,
        punchType: workforcePunchEvents.punchType,
        scannedAt: workforcePunchEvents.scannedAt,
      })
      .from(workforcePunchEvents)
      .where(and(eq(workforcePunchEvents.tenantId, tenantId), eq(workforcePunchEvents.employeeId, ctx.userId)))
      .orderBy(desc(workforcePunchEvents.scannedAt))
      .limit(1);

    // Today's schedule (published timetable version, this user as teacher).
    // Same query shape the teacher-facing timetable view uses, scoped to the
    // session user - a non-teacher employee simply has no slots (real empty).
    let todaySchedule: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      roomLabel: string | null;
      className: string;
      sectionName: string;
      subjectName: string;
    }> = [];

    const todayName = DAY_OF_WEEK[new Date().getDay()]!;
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
        const slots = await db
          .select({
            dayOfWeek: classScheduleSlots.dayOfWeek,
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
          .innerJoin(user, eq(classScheduleSlots.teacherId, user.id))
          .where(and(
            eq(classScheduleSlots.tenantId, tenantId),
            eq(classScheduleSlots.versionId, publishedVer.id),
            eq(classScheduleSlots.teacherId, ctx.userId),
            eq(classScheduleSlots.dayOfWeek, todayName),
          ))
          .orderBy(classScheduleSlots.startTime);

        todaySchedule = slots;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        leaveBalances,
        totalRemaining,
        latestPayslip: latestPayslip ?? null,
        punch: latestPunch ?? null,
        todaySchedule,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
