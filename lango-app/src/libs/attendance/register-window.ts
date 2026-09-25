import { casablancaTimeHm, casablancaTodayIso } from '@/libs/finance/today';

/**
 * THE APPROVED ATTENDANCE WINDOW — the pure half of the rule.
 *
 * A register opens 5 minutes before the lesson starts, stays open through it,
 * and closes 15 minutes after it ends. Outside that the teacher is read-only and
 * a change has to go through an admin correction — so a register cannot be
 * quietly written hours later, and a teacher is not blocked for arriving early.
 *
 * WHY THIS IS ITS OWN MODULE. The rule is used from two places that cannot share
 * a file: the server (Appel du jour, the teacher's current lesson, the QR scan
 * path) and the teacher's register, which runs in the browser and must offer
 * "Activer le scan" only while the window is OPEN. `session-occurrence.ts` reads
 * the database at module scope, so importing it from a Client Component drags
 * Drizzle and `pg` into the browser bundle — `pg` needs `net` and `util/types`,
 * which Next does not polyfill, and the build fails. The rule therefore lives
 * here, free of any database import, and `session-occurrence.ts` re-exports it.
 *
 * There is still exactly ONE implementation: nothing may copy these numbers or
 * re-derive the comparison.
 */

export const REGISTER_OPENS_BEFORE_MINUTES = 5;
export const REGISTER_CLOSES_AFTER_MINUTES = 15;

export type RegisterWindow = 'BEFORE' | 'OPEN' | 'CLOSED';

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function registerWindow(
  occurrence: { startTime: string; endTime: string },
  selectedDate: string,
  now: Date = new Date(),
): RegisterWindow {
  const businessDate = casablancaTodayIso(now);

  // Only today is ever operable; a past lesson is closed, a future one unopened.
  if (selectedDate < businessDate) {
    return 'CLOSED';
  }
  if (selectedDate > businessDate) {
    return 'BEFORE';
  }

  const hm = minutesOf(casablancaTimeHm(now));
  const opens = minutesOf(occurrence.startTime) - REGISTER_OPENS_BEFORE_MINUTES;
  const closes = minutesOf(occurrence.endTime) + REGISTER_CLOSES_AFTER_MINUTES;

  if (hm < opens) {
    return 'BEFORE';
  }
  return hm > closes ? 'CLOSED' : 'OPEN';
}
