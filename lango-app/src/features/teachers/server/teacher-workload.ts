/**
 * Planned weekly workload — derived from the published academic timetable
 * (class_schedule_slots), never from the legacy `user.workload_hours` stopgap
 * column that no UI ever wrote (which is why the Directory used to show 0h for
 * a teacher who visibly had a subject and a class).
 *
 * The source is the teacher's slots in the *published* timetable version of
 * the tenant's default session year. When no published timetable exists the
 * service reports `hasTimetable: false` and the UI renders
 * "Aucune charge planifiée" instead of a misleading 0h.
 */

export type TimetableSlotRange = {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
};

/** "HH:MM" -> minutes since midnight; null when unparseable. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Duration of one slot in hours; 0 when the range is invalid or inverted. */
export function slotDurationHours(slot: TimetableSlotRange): number {
  const start = parseTimeToMinutes(slot.startTime);
  const end = parseTimeToMinutes(slot.endTime);
  if (start === null || end === null || end <= start) {
    return 0;
  }
  return (end - start) / 60;
}

export function sumWeeklyHours(slots: TimetableSlotRange[]): number {
  const total = slots.reduce((acc, slot) => acc + slotDurationHours(slot), 0);
  return Math.round(total * 100) / 100;
}

export type TeacherWorkloadSummary = {
  /** Round(sum of scheduled hours of active teachers) over teachers with a schedule. */
  averageWeeklyHours: number | null;
  totalWeeklyHours: number;
  /** Active teachers that have at least one published slot. */
  scheduledTeachers: number;
  activeTeachers: number;
  hasTimetable: boolean;
  /** Where the number comes from — exposed for the acceptance dump. */
  source: 'published_timetable' | 'none';
};

export function summarizeWorkload(
  totalWeeklyHours: number,
  scheduledTeachers: number,
  activeTeachers: number,
): TeacherWorkloadSummary {
  const hasTimetable = scheduledTeachers > 0;
  return {
    averageWeeklyHours: hasTimetable ? Math.round((totalWeeklyHours / scheduledTeachers) * 100) / 100 : null,
    totalWeeklyHours: Math.round(totalWeeklyHours * 100) / 100,
    scheduledTeachers,
    activeTeachers,
    hasTimetable,
    source: hasTimetable ? 'published_timetable' : 'none',
  };
}
