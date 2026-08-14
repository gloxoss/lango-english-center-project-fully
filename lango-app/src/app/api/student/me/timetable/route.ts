import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classScheduleSlots, user } from '@/models/Schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/timetable — the weekly schedule for the session
// student's class section, grouped by day. Scoped by studentId + tenantId.
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const [me] = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    const classSectionId = me?.classSectionId ?? null;

    const rows = classSectionId
      ? await db
          .select({
            dayOfWeek: classScheduleSlots.dayOfWeek,
            startTime: classScheduleSlots.startTime,
            endTime: classScheduleSlots.endTime,
            roomLabel: classScheduleSlots.roomLabel,
            teacherName: user.name,
          })
          .from(classScheduleSlots)
          .leftJoin(user, eq(classScheduleSlots.teacherId, user.id))
          .where(
            and(
              eq(classScheduleSlots.tenantId, tenantId),
              eq(classScheduleSlots.classSectionId, classSectionId),
            ),
          )
          .orderBy(classScheduleSlots.dayOfWeek, classScheduleSlots.startTime)
      : [];

    const byDay = WEEKDAYS.map((day) => ({
      day,
      slots: rows
        .filter((r) => r.dayOfWeek === day)
        .map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          room: r.roomLabel,
          teacher: r.teacherName,
        })),
    }));

    return NextResponse.json({ success: true, data: { days: byDay } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
