import { and, avg, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, attendanceFlags, attendanceSummary, classes, classScheduleSlots, classSections, classSubjects, sections, sessionYears, subjects, user } from '@/models/Schema';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const reminderSchema = z.object({
  classScheduleSlotId: z.string().uuid(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const today = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const todayDayOfWeek = DAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()]!;

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

    const todaySlots = await db
      .select({
        id: classScheduleSlots.id,
        classSectionId: classScheduleSlots.classSectionId,
        teacherId: classScheduleSlots.teacherId,
        startTime: classScheduleSlots.startTime,
        endTime: classScheduleSlots.endTime,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        teacherName: user.name,
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
        eq(classScheduleSlots.dayOfWeek, todayDayOfWeek),
        ...(context.branchId ? [eq(classes.branchId, context.branchId)] : []),
      ));

    const submittedRows = await db
      .selectDistinct({ classSectionId: user.classSectionId })
      .from(attendance)
      .innerJoin(user, eq(attendance.studentId, user.id))
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.date, today),
        ...(context.branchId ? [eq(user.branchId, context.branchId)] : []),
      ));
    const submittedSectionIds = new Set(submittedRows.map(r => r.classSectionId).filter(Boolean));

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

    const missingRegistersToday = sessionForToday
      ? todaySlots.filter(slot => !submittedSectionIds.has(slot.classSectionId))
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

    const message = result.delivery === 'simulated'
      ? `Rappel enregistré pour ${slot.teacherName} (mode simulation, aucun SMS réel envoyé).`
      : result.delivery === 'failed'
        ? `Échec de l'envoi du rappel à ${slot.teacherName}${result.failureReason ? ` (${result.failureReason})` : ''}.`
        : `Rappel envoyé à ${slot.teacherName}.`;

    return NextResponse.json({
      success: true,
      data: { id: result.id, delivery: result.delivery, simulated: result.delivery === 'simulated' },
      message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
