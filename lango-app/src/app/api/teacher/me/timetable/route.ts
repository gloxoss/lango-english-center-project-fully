import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { rooms, studentGroups, timetableSlots } from '@/models/Schema';
import { requireTeacherContext } from '@/features/teacher/api/guard';

// GET /api/teacher/me/timetable — the full weekly timetable for the session
// teacher, grouped by day. Scoped by teacherId + tenantId.
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;

    const rows = await db
      .select({
        dayOfWeek: timetableSlots.dayOfWeek,
        startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime,
        groupName: studentGroups.name,
        roomName: rooms.name,
      })
      .from(timetableSlots)
      .innerJoin(studentGroups, eq(timetableSlots.studentGroupId, studentGroups.id))
      .innerJoin(rooms, eq(timetableSlots.roomId, rooms.id))
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.teacherId, teacherId),
        ),
      )
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

    const byDay = WEEKDAYS.map((day) => ({
      day,
      slots: rows
        .filter((r) => r.dayOfWeek === day)
        .map((r) => ({ startTime: r.startTime, endTime: r.endTime, group: r.groupName, room: r.roomName })),
    }));

    return NextResponse.json({ success: true, data: { days: byDay } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
