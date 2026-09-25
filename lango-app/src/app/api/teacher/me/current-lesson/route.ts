import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireTeacherContext } from '@/features/teacher/api/guard';
import { apiErrorResponse } from '@/libs/api/errors';
import {
  currentOccurrence,
  listSessionOccurrences,
  loadRegisterIndex,
  nextOccurrence,
  registerForOccurrence,
  registerWindow,
} from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { user } from '@/models/Schema';

/**
 * VOTRE COURS ACTUEL — what the teacher is teaching right now.
 *
 * The teacher never picks a class, subject or period: the lesson is resolved
 * from the published timetable and the current Casablanca time, and the session
 * user is the teacher, so a teacher cannot reach another teacher's lesson by
 * changing a query parameter.
 *
 * The schedule and current lesson come from the same session-occurrence
 * resolver the admin's Appel du jour uses, so the two can never disagree about
 * which lesson is which. The teacher's own timetable *display* stays on the
 * canonical teacher-portal service the release already ships.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;

    const today = casablancaTodayIso();
    const now = new Date();

    // teacherId comes from the session, never from the request.
    const occurrences = await listSessionOccurrences({ tenantId, date: today, teacherId });
    const registerIndex = await loadRegisterIndex(tenantId, today);

    const current = currentOccurrence(occurrences, today, now);
    const upcoming = nextOccurrence(occurrences, today, now);

    // Student headcount for the lesson being taught, so the teacher sees how
    // many names to expect before opening the register.
    let studentCount = 0;
    if (current) {
      const [row] = await db
        .select({ n: count() })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.classSectionId, current.classSectionId),
          eq(user.role, 'student'),
        ));
      studentCount = Number(row?.n ?? 0);
    }

    const schedule = occurrences.map(occurrence => {
      const register = registerForOccurrence(registerIndex, occurrence);
      return {
        slotId: occurrence.slotId,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        subjectName: occurrence.subjectName,
        className: occurrence.className,
        sectionName: occurrence.sectionName,
        room: occurrence.room,
        classSectionId: occurrence.classSectionId,
        window: registerWindow(occurrence, today, now),
        register,
      };
    });

    const toSession = (o: NonNullable<typeof current>) => ({
      slotId: o.slotId,
      startTime: o.startTime,
      endTime: o.endTime,
      subjectName: o.subjectName,
      className: o.className,
      sectionName: o.sectionName,
      room: o.room,
      classSectionId: o.classSectionId,
      window: registerWindow(o, today, now),
      register: registerForOccurrence(registerIndex, o),
    });

    return NextResponse.json({
      success: true,
      data: {
        date: today,
        currentLesson: current ? { ...toSession(current), studentCount } : null,
        nextLesson: upcoming ? toSession(upcoming) : null,
        schedule,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
