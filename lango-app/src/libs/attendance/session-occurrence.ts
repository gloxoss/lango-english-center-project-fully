import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { weekdayNameFor } from '@/libs/api/school-day';
import { db } from '@/libs/DB';
import { casablancaTimeHm, casablancaTodayIso } from '@/libs/finance/today';
import {
  attendanceRegisters,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  sections,
  subjects,
  timetableVersions,
  user,
} from '@/models/Schema';

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
   * Ordinal of this lesson within its section's day, 1-based and ordered by
   * start time. Legacy rows still carry a hand-picked `period`, so a
   * session-keyed register keeps a meaningful value in that column rather than
   * a fabricated 1.
   */
  period: number;
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
  if (opts.teacherId) {
    conditions.push(eq(classScheduleSlots.teacherId, opts.teacherId));
  }
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

  // Period is an ordinal per section per day, so it stays meaningful for the
  // legacy column without inventing a number.
  const seqBySection = new Map<string, number>();

  return rows.map((row) => {
    const next = (seqBySection.get(row.classSectionId) ?? 0) + 1;
    seqBySection.set(row.classSectionId, next);
    return { ...row, date: opts.date, versionId: row.versionId ?? null, period: next };
  });
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
  occurrence: Pick<SessionOccurrence, 'startTime' | 'endTime'>,
  register: RegisterLike,
  now: { date: string; hm: string; selectedDate: string },
  cancelled = false,
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

/**
 * Occurrences whose lesson has ENDED and which still have no valid register.
 * This is the exact-session answer to "registres manquants": one completed
 * lesson can no longer hide a different missing one.
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
    if (cancelledSlotIds.has(occurrence.slotId)) {
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
