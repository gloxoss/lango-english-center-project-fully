/**
 * CANONICAL WEEKLY TIMETABLE GRID (S-12 single source of truth).
 *
 * 6 teaching days x 7 one-hour periods — the exact grid the constraint solver
 * places slots into (POST /api/academics/timetable-versions/generate) and the
 * grid the schedule UI renders. The domain has NO tenant-configurable bell
 * schedule / class-periods model (verified: no class_periods table, no periods
 * endpoint, no timetable settings key), so this static grid is the
 * authoritative configuration. Any future period model must replace THIS
 * module so the generator and the UI can never drift apart again.
 */
export const TIMETABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const TIMETABLE_PERIODS: ReadonlyArray<{ start: string; end: string }> = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
];
