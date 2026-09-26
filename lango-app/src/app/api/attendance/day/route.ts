import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import {
  listSessionOccurrences,
  loadRegisterIndex,
  occurrenceState,
  registerForOccurrence,
} from '@/libs/attendance/session-occurrence';
import { casablancaTimeHm, casablancaTodayIso } from '@/libs/finance/today';
import { db } from '@/libs/DB';
import { attendance, attendanceRegisters, classes } from '@/models/Schema';

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
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    const allowed = context.role === 'super_admin'
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.read'))
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.scan'));
    if (!allowed) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Droit attendance.read ou attendance.scan requis.');
    }

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
        baseStartTime: occurrence.baseStartTime,
        baseEndTime: occurrence.baseEndTime,
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
        // The dated deviation, if this lesson has one. The timing, room and
        // teacher above are already the EFFECTIVE values; this is what changed
        // and why, so the screen can show original vs effective.
        exception: occurrence.exception,
      };
    });

    // The mode tells the screen what it may offer, so past/today/future rules are
    // decided server-side rather than re-derived in the client.
    const mode = date < businessDate ? 'past' : date > businessDate ? 'future' : 'today';

    let legacyRegisters: {
      id: string;
      classId: string;
      className: string | null;
      counts: { present: number; late: number; absent: number; excused: number };
    }[] = [];

    if (mode === 'past') {
      const legacyRegs = await db
        .select({
          id: attendanceRegisters.id,
          classId: attendanceRegisters.classId,
          className: classes.name,
        })
        .from(attendanceRegisters)
        .leftJoin(classes, eq(attendanceRegisters.classId, classes.id))
        .where(and(
          eq(attendanceRegisters.tenantId, tenantId),
          eq(attendanceRegisters.date, date),
          isNull(attendanceRegisters.classScheduleSlotId),
        ));

      for (const reg of legacyRegs) {
        const [countsRow] = await db
          .select({
            present: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
            late: sql<number>`count(*) filter (where ${attendance.status} = 'late')::int`,
            absent: sql<number>`count(*) filter (where ${attendance.status} = 'absent')::int`,
            excused: sql<number>`count(*) filter (where ${attendance.status} = 'excused')::int`,
          })
          .from(attendance)
          .where(and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.date, date),
            eq(attendance.studentGroupId, reg.classId),
            eq(attendance.isVoided, false),
          ));

        legacyRegisters.push({
          id: reg.id,
          classId: reg.classId,
          className: reg.className,
          counts: {
            present: countsRow?.present ?? 0,
            late: countsRow?.late ?? 0,
            absent: countsRow?.absent ?? 0,
            excused: countsRow?.excused ?? 0,
          },
        });
      }
    }

    const adjustedSessions = sessions.map((s) => {
      if (mode === 'past' && legacyRegisters.length > 0 && s.state === 'A_COMPLETER') {
        return { ...s, state: 'NON_POINTE' as const };
      }
      return s;
    });

    return NextResponse.json({
      success: true,
      data: {
        date,
        businessDate,
        mode,
        sessions: adjustedSessions,
        legacyRegisters,
        counts: {
          total: adjustedSessions.length,
          toComplete: adjustedSessions.filter(s => s.state === 'A_COMPLETER').length,
          nonPointe: adjustedSessions.filter(s => (s.state as string) === 'NON_POINTE').length,
          done: adjustedSessions.filter(s => s.state === 'POINTAGE_TERMINE' || s.state === 'CORRIGE').length,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
