import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classScheduleSlots, sessionYears } from '@/models/Schema';

/**
 * CANONICAL INSTRUCTIONAL-DAY RESOLVER (Phase 5).
 *
 * Truthful contract supported by the current SchoolOS model:
 *   1. the date must fall inside an academic session (authoritative);
 *   2. when the section has timetable slots, those slots are the authoritative
 *      meeting days (TIMETABLE_DAY);
 *   3. otherwise the legacy SchoolOS weekend rule applies (Sat/Sun), which is
 *      the ONLY weekday convention present in the codebase today — there is no
 *      school-week configuration, holiday table, closure model or exceptional
 *      teaching-day model. Those are reported as deferred, never fabricated.
 */

export type InstructionalDayReason
  = | 'SESSION_OUT_OF_RANGE'
    | 'TIMETABLE_DAY'
    | 'NON_WORKING_WEEKDAY';

export type InstructionalDayResult = {
  instructional: boolean;
  reason: InstructionalDayReason;
  sessionYearId: string | null;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export function weekdayNameFor(date: string): typeof DAY_NAMES[number] {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

export async function resolveInstructionalDay(opts: {
  tenantId: string;
  sectionId: string;
  date: string;
}): Promise<InstructionalDayResult> {
  const { tenantId, sectionId, date } = opts;

  const [session] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(
      eq(sessionYears.tenantId, tenantId),
      sql`${sessionYears.startDate}::date <= ${date}::date`,
      sql`${sessionYears.endDate}::date >= ${date}::date`,
    ))
    .limit(1);

  if (!session) {
    return { instructional: false, reason: 'SESSION_OUT_OF_RANGE', sessionYearId: null };
  }

  const slots = await db
    .select({ dayOfWeek: classScheduleSlots.dayOfWeek })
    .from(classScheduleSlots)
    .where(and(
      eq(classScheduleSlots.tenantId, tenantId),
      eq(classScheduleSlots.classSectionId, sectionId),
    ));

  if (slots.length > 0) {
    const weekday = weekdayNameFor(date);
    const expected = slots.some(slot => slot.dayOfWeek === weekday);
    return { instructional: expected, reason: 'TIMETABLE_DAY', sessionYearId: session.id };
  }

  // Legacy SchoolOS weekend rule (documented; no school-week configuration
  // exists in the product yet).
  const weekday = weekdayNameFor(date);
  const isWeekend = weekday === 'saturday' || weekday === 'sunday';
  return { instructional: !isWeekend, reason: 'NON_WORKING_WEEKDAY', sessionYearId: session.id };
}

/** Convenience predicate used by flag/escalation logic. */
export async function isInstructionalDay(tenantId: string, sectionId: string, date: string): Promise<boolean> {
  const result = await resolveInstructionalDay({ tenantId, sectionId, date });
  return result.instructional;
}
