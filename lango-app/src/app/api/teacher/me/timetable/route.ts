import { NextResponse } from 'next/server';
import { requireTeacherContext } from '@/features/teacher/api/guard';
import { listTeacherSessions } from '@/features/teacher/server/teacher-portal';
import { apiErrorResponse } from '@/libs/api/errors';

// GET /api/teacher/me/timetable — the full weekly timetable for the session
// teacher, grouped by day. Scoped by teacherId + tenantId, read from the
// canonical published class_schedule_slots (see teacher-portal.ts).
// Monday-first: the Moroccan school week runs Monday-Saturday, and the
// purpose-built schedule page renders the same order.
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;

    const rows = await listTeacherSessions(tenantId, teacherId);

    const byDay = WEEKDAYS.map(day => ({
      day,
      slots: rows.filter(row => row.dayOfWeek === day).map(row => ({
        startTime: row.startTime,
        endTime: row.endTime,
        group: row.group,
        room: row.room,
      })),
    }));

    return NextResponse.json({ success: true, data: { days: byDay } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
