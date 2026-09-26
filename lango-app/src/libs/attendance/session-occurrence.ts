import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { weekdayNameFor } from '@/libs/api/school-day';
import { db } from '@/libs/DB';
import { casablancaTimeHm, casablancaTodayIso } from '@/libs/finance/today';
import {
  attendanceRegisters,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  classSessionExceptions,
  sections,
  subjects,
  timetableVersions,
  user,
} from '@/models/Schema';
import { minutesOf, registerWindow } from './register-window';

// The substitute is a different user row from the slot's own teacher, so the
// second join needs its own alias.
const teacherUser = alias(user, 'substitute_teacher');

/**
 * CANONICAL SESSION OCCURRENCE — the identity attendance is actually about.
 *
 *     class_schedule_slots  x  concrete date   (under the published, effective version)
 *
 * A slot already carries section, subject, teacher, start/end, room and version,
 * so the pair (slot, date) names one scheduled lesson without materialising a row
 * per school day. Everything that needs "which lesson?" — the admin Appel du
 * jour, the teacher's current lesson, missing registers, alerts, the kiosk and
 * reporting — resolves through here, so they cannot disagree.
 *
 * Exceptions (cancellation, substitution, room change, reschedule) attach to the
 * same identity in phase 6.
 */

export type SessionExceptionType = 'CANCELLED' | 'SUBSTITUTE' | 'ROOM_CHANGE' | 'RESCHEDULE';

export type SessionException = {
  type: SessionExceptionType;
  reason: string;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  roomLabel: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type SessionOccurrence = {
  slotId: string;
  versionId: string | null;
  date: string;
  classSectionId: string;
  classSubjectId: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
  branchId: string | null;
  className: string | null;
  sectionName: string | null;
  room: string | null;
  startTime: string;
  endTime: string;
  /**
   * The timetable's own times, before any exception. Kept so a screen can show
   * what the lesson WAS alongside what it is now — "moved to 10:00" is only
   * meaningful next to "usually 08:00".
   */
  baseStartTime: string;
  baseEndTime: string;
  /**
   * Ordinal of this lesson within its section's day, 1-based and ordered by
   * start time. Legacy rows still carry a hand-picked `period`, so a
   * session-keyed register keeps a meaningful value in that column rather than
   * a fabricated 1.
   */
  period: number;
  /** The dated deviation applied to this occurrence, if any (phase 6). */
  exception: SessionException | null;
};

export type OccurrenceState
  = | 'A_VENIR'
    | 'EN_COURS'
    | 'A_COMPLETER'
    | 'POINTAGE_TERMINE'
    | 'CORRIGE'
    | 'ANNULE';

type RegisterLike = { status: string } | null | undefined;

/**
 * Dated deviations for a whole day, keyed by slot. Loaded once per day view so
 * the merge below costs one query rather than one per lesson.
 */
export async function loadSessionExceptions(
  tenantId: string,
  date: string,
): Promise<Map<string, SessionException>> {
  const rows = await db
    .select({
      slotId: classSessionExceptions.classScheduleSlotId,
      type: classSessionExceptions.type,
      reason: classSessionExceptions.reason,
      substituteTeacherId: classSessionExceptions.substituteTeacherId,
      substituteTeacherName: teacherUser.name,
      roomLabel: classSessionExceptions.roomLabel,
      startTime: classSessionExceptions.startTime,
      endTime: classSessionExceptions.endTime,
    })
    .from(classSessionExceptions)
    .leftJoin(teacherUser, eq(classSessionExceptions.substituteTeacherId, teacherUser.id))
    .where(and(eq(classSessionExceptions.tenantId, tenantId), eq(classSessionExceptions.date, date)));

  const bySlot = new Map<string, SessionException>();

  for (const row of rows) {
    bySlot.set(row.slotId, {
      type: row.type as SessionExceptionType,
      reason: row.reason,
      substituteTeacherId: row.substituteTeacherId,
      substituteTeacherName: row.substituteTeacherName,
      roomLabel: row.roomLabel,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  return bySlot;
}

/**
 * The timetable version that governs `date`: published, and effective on it.
 * Drafts and superseded versions must never create an expectation of a lesson.
 * Returns null when no published version covers the date.
 */
export async function resolveEffectiveTimetableVersion(
  tenantId: string,
  date: string,
): Promise<{ id: string; versionNumber: number } | null> {
  const [row] = await db
    .select({ id: timetableVersions.id, versionNumber: timetableVersions.versionNumber })
    .from(timetableVersions)
    .where(and(
      eq(timetableVersions.tenantId, tenantId),
      eq(timetableVersions.status, 'published'),
      or(isNull(timetableVersions.effectiveFrom), lte(timetableVersions.effectiveFrom, date))!,
      or(isNull(timetableVersions.effectiveTo), gte(timetableVersions.effectiveTo, date))!,
    ))
    .orderBy(timetableVersions.versionNumber)
    .limit(1);

  return row ?? null;
}

/**
 * Every scheduled lesson of `date`, optionally narrowed to a branch, a teacher
 * or a single section. Callers pass the actor's own scope — this function does
 * no authorization of its own.
 */
export async function listSessionOccurrences(opts: {
  tenantId: string;
  date: string;
  branchId?: string | null;
  teacherId?: string | null;
  classSectionId?: string | null;
}): Promise<SessionOccurrence[]> {
  const version = await resolveEffectiveTimetableVersion(opts.tenantId, opts.date);
  if (!version) {
    return [];
  }

  const conditions = [
    eq(classScheduleSlots.tenantId, opts.tenantId),
    eq(classScheduleSlots.dayOfWeek, weekdayNameFor(opts.date)),
    eq(classScheduleSlots.versionId, version.id),
  ];
  if (opts.branchId) {
    conditions.push(eq(classes.branchId, opts.branchId));
  }
  // NOTE: the teacher filter is applied AFTER the exception merge, not here. A
  // substitute is not the slot's teacher, so filtering in SQL would hide the
  // very lesson they are covering.
  if (opts.classSectionId) {
    conditions.push(eq(classScheduleSlots.classSectionId, opts.classSectionId));
  }

  const rows = await db
    .select({
      slotId: classScheduleSlots.id,
      versionId: classScheduleSlots.versionId,
      classSectionId: classScheduleSlots.classSectionId,
      classSubjectId: classScheduleSlots.classSubjectId,
      subjectId: classSubjects.subjectId,
      subjectName: subjects.name,
      teacherId: classScheduleSlots.teacherId,
      teacherName: user.name,
      branchId: classes.branchId,
      className: classes.name,
      sectionName: sections.name,
      room: classScheduleSlots.roomLabel,
      startTime: classScheduleSlots.startTime,
      endTime: classScheduleSlots.endTime,
    })
    .from(classScheduleSlots)
    .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .leftJoin(user, eq(classScheduleSlots.teacherId, user.id))
    .where(and(...conditions))
    .orderBy(asc(classScheduleSlots.startTime));

  const exceptions = await loadSessionExceptions(opts.tenantId, opts.date);

  // Period is an ordinal per section per day, so it stays meaningful for the
  // legacy column without inventing a number. Ordinals are assigned from the
  // BASE order so a reschedule cannot renumber a lesson that already has a
  // register against its period.
  const seqBySection = new Map<string, number>();

  const merged = rows.map((row) => {
    const next = (seqBySection.get(row.classSectionId) ?? 0) + 1;
    seqBySection.set(row.classSectionId, next);

    const exception = exceptions.get(row.slotId) ?? null;

    // An exception overrides only the field it is about. The base timetable row
    // is never mutated — this is a view of one day.
    return {
      ...row,
      date: opts.date,
      versionId: row.versionId ?? null,
      period: next,
      teacherId: exception?.substituteTeacherId ?? row.teacherId,
      teacherName: exception?.substituteTeacherName ?? row.teacherName,
      room: exception?.roomLabel ?? row.room,
      startTime: exception?.startTime ?? row.startTime,
      endTime: exception?.endTime ?? row.endTime,
      baseStartTime: row.startTime,
      baseEndTime: row.endTime,
      exception,
    };
  });

  // A substitute sees the lesson they are covering, and only that one.
  const scoped = opts.teacherId
    ? merged.filter(o => o.teacherId === opts.teacherId)
    : merged;

  // Order on the EFFECTIVE start time: a rescheduled lesson must appear where it
  // actually happens, not where the weekly recurrence usually sits.
  return scoped.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** The scheduled lessons of `date` for one section. */
export async function occurrencesForSection(
  tenantId: string,
  classSectionId: string,
  date: string,
): Promise<SessionOccurrence[]> {
  const all = await listSessionOccurrences({ tenantId, date, classSectionId });
  return all;
}

/**
 * Register state for a date, keyed two ways at once: by exact occurrence (new
 * rows) and by the legacy (section, period) pair (old rows). The legacy key
 * keeps pre-0158 history answering for the lesson it actually covered.
 */
export async function loadRegisterIndex(
  tenantId: string,
  date: string,
): Promise<{
  bySlot: Map<string, { id: string; status: string; reference: string }>;
  bySectionPeriod: Map<string, { id: string; status: string; reference: string }>;
}> {
  const rows = await db
    .select({
      id: attendanceRegisters.id,
      status: attendanceRegisters.status,
      reference: attendanceRegisters.reference,
      classSectionId: attendanceRegisters.classSectionId,
      classScheduleSlotId: attendanceRegisters.classScheduleSlotId,
      period: attendanceRegisters.period,
    })
    .from(attendanceRegisters)
    .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.date, date)));

  const bySlot = new Map<string, { id: string; status: string; reference: string }>();
  const bySectionPeriod = new Map<string, { id: string; status: string; reference: string }>();

  for (const row of rows) {
    const value = { id: row.id, status: row.status, reference: row.reference };
    if (row.classScheduleSlotId) {
      bySlot.set(row.classScheduleSlotId, value);
    }
    if (row.classSectionId) {
      bySectionPeriod.set(`${row.classSectionId}|${row.period}`, value);
    }
  }

  return { bySlot, bySectionPeriod };
}

/** The register that answers for this exact occurrence, new key first. */
export function registerForOccurrence(
  index: Awaited<ReturnType<typeof loadRegisterIndex>>,
  occurrence: SessionOccurrence,
): { id: string; status: string; reference: string } | null {
  const bySlot = index.bySlot.get(occurrence.slotId);
  if (bySlot) {
    return bySlot;
  }
  return index.bySectionPeriod.get(`${occurrence.classSectionId}|${occurrence.period}`) ?? null;
}

/**
 * Operational state of one lesson. Order matters: a reopened register is a
 * correction, not a fresh submission; a lesson only becomes "à compléter" once
 * its END time has passed in Casablanca.
 */
export function occurrenceState(
  occurrence: Pick<SessionOccurrence, 'startTime' | 'endTime'> & { exception?: SessionException | null },
  register: RegisterLike,
  now: { date: string; hm: string; selectedDate: string },
  // Derived from the occurrence by default, so a caller holding a real
  // occurrence cannot forget to pass it. An explicit argument still wins, for
  // callers holding only times.
  cancelled: boolean = isCancelled(occurrence),
): OccurrenceState {
  if (cancelled) {
    return 'ANNULE';
  }
  if (register?.status === 'REOPENED') {
    return 'CORRIGE';
  }
  if (register && register.status === 'LOCKED') {
    return 'POINTAGE_TERMINE';
  }

  // The date decides whether the lesson is OVER; it never decides whether a
  // register exists. A past lesson with no register is overdue ("à compléter"),
  // not "pointage terminé" — that state belongs to a register that exists.
  //
  // A past date is over in full whatever the clock says now; a future date has
  // not begun. Only "today" is judged against the current time.
  const ended = now.selectedDate < now.date
    ? true
    : now.selectedDate > now.date
      ? false
      : occurrence.endTime <= now.hm;

  if (ended) {
    return 'A_COMPLETER';
  }
  if (now.selectedDate > now.date || now.hm < occurrence.startTime) {
    return 'A_VENIR';
  }
  return 'EN_COURS';
}

/** A lesson cancelled for this date never becomes a missing register. */
export function isCancelled(occurrence: { exception?: SessionException | null }): boolean {
  return occurrence.exception?.type === 'CANCELLED';
}

/**
 * Occurrences whose lesson has ENDED and which still have no valid register.
 * This is the exact-session answer to "registres manquants": one completed
 * lesson can no longer hide a different missing one, and a cancelled lesson is
 * never expected to have one.
 */
export function missingOccurrences(
  occurrences: SessionOccurrence[],
  index: Awaited<ReturnType<typeof loadRegisterIndex>>,
  selectedDate: string,
  now: Date = new Date(),
  cancelledSlotIds: ReadonlySet<string> = new Set(),
): SessionOccurrence[] {
  const businessDate = casablancaTodayIso(now);
  const hm = casablancaTimeHm(now);

  return occurrences.filter((occurrence) => {
    if (cancelledSlotIds.has(occurrence.slotId) || isCancelled(occurrence)) {
      return false;
    }
    if (registerForOccurrence(index, occurrence)) {
      return false;
    }
    if (selectedDate < businessDate) {
      return true; // the whole day is over
    }
    if (selectedDate > businessDate) {
      return false; // preview only
    }
    return occurrence.endTime <= hm;
  });
}

// THE APPROVED ATTENDANCE WINDOW lives in ./register-window: the teacher's
// register runs in the browser and has to ask the same question, and this file
// reads the database at module scope. Re-exported here so every existing caller
// keeps one import path, and so there is still exactly one implementation.
export {
  REGISTER_CLOSES_AFTER_MINUTES,
  REGISTER_OPENS_BEFORE_MINUTES,
  registerWindow,
} from './register-window';
export type { RegisterWindow } from './register-window';

/**
 * The lesson the teacher is teaching right now, i.e. the one whose window is
 * open. When two overlap (a data error) the later start wins: that is the one
 * actually being taught.
 *
 * Generic over the row shape: callers may hold the full occurrence or a lighter
 * projection, and only the times are needed to decide.
 */
export function currentOccurrence<T extends Pick<SessionOccurrence, 'startTime' | 'endTime'>>(
  occurrences: T[],
  selectedDate: string,
  now: Date = new Date(),
): T | null {
  const open = occurrences.filter(o => registerWindow(o, selectedDate, now) === 'OPEN');
  return open.length > 0 ? open[open.length - 1]! : null;
}

/** The next lesson that has not started yet, for the "no lesson now" state. */
export function nextOccurrence<T extends Pick<SessionOccurrence, 'startTime' | 'endTime'>>(
  occurrences: T[],
  selectedDate: string,
  now: Date = new Date(),
): T | null {
  const businessDate = casablancaTodayIso(now);
  if (selectedDate < businessDate) {
    return null;
  }
  if (selectedDate > businessDate) {
    return occurrences[0] ?? null;
  }
  const hm = minutesOf(casablancaTimeHm(now));
  return occurrences.find(o => minutesOf(o.startTime) > hm) ?? null;
}
