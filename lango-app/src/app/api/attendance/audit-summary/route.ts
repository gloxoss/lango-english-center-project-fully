import { and, avg, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, attendanceFlags, attendanceSummary, classes, classScheduleSlots, classSections, classSubjects, sections, smsMessages, subjects, user } from '@/models/Schema';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const reminderSchema = z.object({
  classScheduleSlotId: z.string().uuid(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const today = new Date().toISOString().slice(0, 10);
    const todayDayOfWeek = DAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()]!;

    const [summaryStats] = await db
      .select({
        avgRate: avg(attendanceSummary.attendanceRate),
        atRiskCount: sql<number>`count(*) filter (where ${attendanceSummary.attendanceRate} < 80)::int`,
        totalTracked: count(),
      })
      .from(attendanceSummary)
      .where(eq(attendanceSummary.tenantId, tenantId));

    const openFlagsByType = await db
      .select({ type: attendanceFlags.type, count: sql<number>`count(*)::int` })
      .from(attendanceFlags)
      .where(and(eq(attendanceFlags.tenantId, tenantId), eq(attendanceFlags.status, 'OPEN')))
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
      .where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.dayOfWeek, todayDayOfWeek)));

    const submittedRows = await db
      .selectDistinct({ classSectionId: user.classSectionId })
      .from(attendance)
      .innerJoin(user, eq(attendance.studentId, user.id))
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, today)));
    const submittedSectionIds = new Set(submittedRows.map(r => r.classSectionId).filter(Boolean));

    const missingRegistersToday = todaySlots.filter(slot => !submittedSectionIds.has(slot.classSectionId));

    return NextResponse.json({
      success: true,
      data: {
        overallAttendanceRate: summaryStats?.avgRate ? Number(summaryStats.avgRate).toFixed(2) : null,
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

    const now = new Date().toISOString();
    const [inserted] = await db
      .insert(smsMessages)
      .values({
        tenantId,
        recipientPhone: slot.teacherPhone,
        body: `Rappel: la présence n'a pas encore été enregistrée pour votre cours d'aujourd'hui.`,
        status: 'sent',
        sentAt: now,
        createdById: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'sms_message', inserted!.id, { reason: 'missing_attendance_register_reminder', teacherId: slot.teacherId });

    return NextResponse.json({
      success: true,
      data: inserted,
      message: `Rappel simulé envoyé à ${slot.teacherName} (mode simulation, aucun SMS réel envoyé).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
