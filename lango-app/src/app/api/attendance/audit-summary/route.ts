import { and, avg, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { weekdayNameFor } from '@/libs/api/school-day';
import { parseJson } from '@/libs/api/validation';
import { listSessionOccurrences, loadRegisterIndex, missingOccurrences } from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { attendance, attendanceFlags, attendanceSummary, classScheduleSlots, sessionYears, user } from '@/models/Schema';

const reminderSchema = z.object({
  classScheduleSlotId: z.string().uuid(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    // The business day is the school's, not the server's: a UTC date reports
    // yesterday during Moroccan mornings.
    const today = searchParams.get('date') || casablancaTodayIso();
    const todayDayOfWeek = weekdayNameFor(today);

    // BRANCH SCOPE (P0): every aggregate is scoped through the student row so
    // a branch-limited principal only audits their own campus.
    const summaryConditions = [eq(attendanceSummary.tenantId, tenantId)];
    const flagConditions = [eq(attendanceFlags.tenantId, tenantId), eq(attendanceFlags.status, 'OPEN')];
    if (context.branchId) {
      summaryConditions.push(eq(user.branchId, context.branchId));
      flagConditions.push(eq(user.branchId, context.branchId));
    }

    const [summaryStats] = await db
      .select({
        avgRate: avg(attendanceSummary.attendanceRate),
        atRiskCount: sql<number>`count(*) filter (where ${attendanceSummary.attendanceRate} < 80)::int`,
        totalTracked: count(),
      })
      .from(attendanceSummary)
      .innerJoin(user, eq(attendanceSummary.studentId, user.id))
      .where(and(...summaryConditions));

    const openFlagsByType = await db
      .select({ type: attendanceFlags.type, count: sql<number>`count(*)::int` })
      .from(attendanceFlags)
      .innerJoin(user, eq(attendanceFlags.studentId, user.id))
      .where(and(...flagConditions))
      .groupBy(attendanceFlags.type);

    // EXACT SESSION IDENTITY (phase 1). Expectations are scheduled session
    // occurrences — a timetable slot on this date under the published effective
    // version — and a lesson is answered by the register for THAT occurrence.
    // One completed lesson can no longer hide a different missing one.
    const occurrences = await listSessionOccurrences({
      tenantId,
      date: today,
      branchId: context.branchId,
    });
    const registerIndex = await loadRegisterIndex(tenantId, today);

    // CALENDAR GUARD (Phase 5): a date outside every academic session can
    // never produce a "missing register" expectation.
    const [sessionForToday] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(
        eq(sessionYears.tenantId, tenantId),
        sql`${sessionYears.startDate}::date <= ${today}::date`,
        sql`${sessionYears.endDate}::date >= ${today}::date`,
      ))
      .limit(1);

    // Exact-occurrence answer: a lesson counts as missing only when its own
    // occurrence has ended and no register answers for it.
    const missingRegistersToday = sessionForToday
      ? missingOccurrences(occurrences, registerIndex, today).map(occurrence => ({
          id: occurrence.slotId,
          classSectionId: occurrence.classSectionId,
          classScheduleSlotId: occurrence.slotId,
          teacherId: occurrence.teacherId,
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          period: occurrence.period,
          room: occurrence.room,
          className: occurrence.className,
          sectionName: occurrence.sectionName,
          subjectName: occurrence.subjectName,
          teacherName: occurrence.teacherName,
        }))
      : [];

    return NextResponse.json({
      success: true,
      data: {
        overallAttendanceRate: summaryStats?.avgRate != null ? Number(summaryStats.avgRate).toFixed(2) : null,
        totalStudentsTracked: summaryStats?.totalTracked ?? 0,
        atRiskCount: summaryStats?.atRiskCount ?? 0,
        openFlagsByType,
        missingRegistersToday,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// Sends a real (log-only, simulated) SMS reminder to the assigned teacher for a
// class-schedule slot that has no attendance submitted yet today.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, reminderSchema);

    const [slot] = await db
      .select({ teacherId: classScheduleSlots.teacherId, teacherPhone: user.phone, teacherName: user.name })
      .from(classScheduleSlots)
      .innerJoin(user, eq(classScheduleSlots.teacherId, user.id))
      .where(and(eq(classScheduleSlots.id, body.classScheduleSlotId), eq(classScheduleSlots.tenantId, tenantId)))
      .limit(1);

    if (!slot) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Créneau introuvable' } }, { status: 404 });
    }
    if (!slot.teacherPhone) {
      return NextResponse.json({ success: false, error: { code: 'NO_PHONE', message: 'Aucun numéro de téléphone enregistré pour cet enseignant' } }, { status: 400 });
    }

    const result = await sendSmsMessage(tenantId, {
      to: slot.teacherPhone,
      body: `Rappel: la présence n'a pas encore été enregistrée pour votre cours d'aujourd'hui.`,
      createdById: context.userId,
    });

    recordAudit(context, 'create', 'sms_message', result.id, { reason: 'missing_attendance_register_reminder', teacherId: slot.teacherId });

    const code = result.delivery === 'simulated'
      ? 'REMINDER_SIMULATED'
      : result.delivery === 'failed'
        ? 'REMINDER_FAILED'
        : 'REMINDER_SENT';

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        delivery: result.delivery,
        simulated: result.delivery === 'simulated',
        code,
        teacherName: slot.teacherName,
        failureReason: result.failureReason || null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
