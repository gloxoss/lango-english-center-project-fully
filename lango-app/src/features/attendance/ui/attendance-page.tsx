import { AppelDuJourView } from './appel-du-jour-view';
import { AttendanceClient } from './attendance-client';

/**
 * /dashboard/attendance is "Appel du jour": the day's lessons from the published
 * timetable, in order, with their attendance state.
 *
 * The old screen asked the admin to reconstruct a lesson by hand — class,
 * subject, and a "Période 1–8" number that comes from no timetable. That picker
 * no longer appears in the normal flow. Opening one specific lesson
 * (?slot=…&date=…) goes straight to its roll-call grid with the context already
 * resolved, so the admin never rebuilds a lesson that the timetable already knows.
 */
export async function AttendancePage({
  locale,
  slotId,
  date,
  mode,
}: { locale?: string; slotId?: string; date?: string; mode?: 'scan' | 'manual' } = {}) {
  if (slotId && date) {
    return <AttendanceClient locale={locale} session={{ slotId, date }} initialMode={mode} />;
  }
  return <AppelDuJourView />;
}
