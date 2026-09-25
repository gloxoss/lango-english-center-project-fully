import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import {
  listSessionOccurrences,
  loadRegisterIndex,
  occurrenceState,
  registerForOccurrence,
} from '@/libs/attendance/session-occurrence';
import { casablancaTimeHm, casablancaTodayIso } from '@/libs/finance/today';

/**
 * APPEL DU JOUR — the day's real lessons, from the timetable.
 *
 * Answers the admin's actual question ("what do I still have to do today?")
 * without a class/subject/period picker. The identity is the scheduled session
 * occurrence, so a lesson's status comes from the register for THAT lesson and
 * never from "does this section have any mark today".
 *
 * Scope is taken from the request context, never from the query string: a
 * campus-limited admin sees their campus, a teacher sees only their own lessons.
 */
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.read');

    const { searchParams } = new URL(request.url);
    const businessDate = casablancaTodayIso();
    const date = searchParams.get('date') || businessDate;

    const isTeacher = context.role === 'teacher';

    const occurrences = await listSessionOccurrences({
      tenantId,
      date,
      branchId: context.branchId,
      teacherId: isTeacher ? context.userId : null,
    });

    const registerIndex = await loadRegisterIndex(tenantId, date);
    const now = { date: businessDate, hm: casablancaTimeHm(), selectedDate: date };

    const sessions = occurrences.map((occurrence) => {
      const register = registerForOccurrence(registerIndex, occurrence);
      return {
        slotId: occurrence.slotId,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        subjectName: occurrence.subjectName,
        // Ids, not just labels: the roll-call grid keys its subject filter on the
        // subject id, so a session-scoped open can select it without a picker.
        subjectId: occurrence.subjectId,
        classSubjectId: occurrence.classSubjectId,
        className: occurrence.className,
        sectionName: occurrence.sectionName,
        teacherId: occurrence.teacherId,
        teacherName: occurrence.teacherName,
        room: occurrence.room,
        branchId: occurrence.branchId,
        classSectionId: occurrence.classSectionId,
        period: occurrence.period,
        state: occurrenceState(occurrence, register, now),
        register,
      };
    });

    // The mode tells the screen what it may offer, so past/today/future rules are
    // decided server-side rather than re-derived in the client.
    const mode = date < businessDate ? 'past' : date > businessDate ? 'future' : 'today';

    return NextResponse.json({
      success: true,
      data: {
        date,
        businessDate,
        mode,
        sessions,
        counts: {
          total: sessions.length,
          toComplete: sessions.filter(s => s.state === 'A_COMPLETER').length,
          done: sessions.filter(s => s.state === 'POINTAGE_TERMINE' || s.state === 'CORRIGE').length,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
