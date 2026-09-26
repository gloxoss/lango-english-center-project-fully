/**
 * The counting rule behind `scripts/report-corrupted-period1-marks.ts`, kept
 * pure so it can be tested without a database.
 *
 * A mark is corrupt when the QR path stored it against period 1 but the clock
 * says the scan happened during a different lesson. The window is imported from
 * the register rather than copied, so the report and the route that writes marks
 * cannot drift apart.
 */

import type { SessionOccurrence } from './session-occurrence';
import {
  REGISTER_CLOSES_AFTER_MINUTES,
  REGISTER_OPENS_BEFORE_MINUTES,
} from './session-occurrence';

export type Period1Verdict = 'CORRUPTED' | 'OK_PERIOD_1' | 'UNDECIDABLE';

export type Period1Classification = {
  verdict: Period1Verdict;
  /** The lesson the clock says this happened in, when one was found. */
  foundPeriod: number | null;
};

type Timed = Pick<SessionOccurrence, 'startTime' | 'endTime'>;
type Perioded = Pick<SessionOccurrence, 'period' | 'startTime' | 'endTime'>;

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function registerWindowOf(startTime: string, endTime: string): { opens: number; closes: number } {
  return {
    opens: minutesOf(startTime) - REGISTER_OPENS_BEFORE_MINUTES,
    closes: minutesOf(endTime) + REGISTER_CLOSES_AFTER_MINUTES,
  };
}

/**
 * The lesson a scan belongs to.
 *
 * Adjacent lessons have OVERLAPPING register windows: lesson 1 ending 08:55
 * stays open until 09:10, while lesson 2 opened at 08:55. So a 09:00 scan sits
 * in both windows, and taking the first match would file it under the lesson
 * that has already finished. A lesson actually in session wins; the window is
 * only the fallback for a scan taken just before or just after one.
 */
export function occurrenceAt<T extends Timed>(minute: number, live: T[]): T | undefined {
  const inSession = live.find(o => minute >= minutesOf(o.startTime) && minute <= minutesOf(o.endTime));
  if (inSession) {
    return inSession;
  }

  return live.find((o) => {
    const { opens, closes } = registerWindowOf(o.startTime, o.endTime);
    return minute >= opens && minute <= closes;
  });
}

/**
 * `storedPeriod` is what the row says, passed in rather than assumed to be 1 so
 * the rule reads as the check it is instead of hard-coding the bug it hunts.
 */
export function classifyPeriod1Mark<T extends Perioded>(
  localMinute: number,
  live: T[],
  storedPeriod: number,
): Period1Classification {
  const containing = occurrenceAt(localMinute, live);
  if (!containing) {
    return { verdict: 'UNDECIDABLE', foundPeriod: null };
  }
  if (containing.period === storedPeriod) {
    return { verdict: 'OK_PERIOD_1', foundPeriod: containing.period };
  }
  return { verdict: 'CORRUPTED', foundPeriod: containing.period };
}
