// Date-boundary regression suite. Two rules the hostel module used to break:
//
//   1. "Today" is the Casablanca school day (libs/finance/today.ts). Reading it
//      off the server clock answered "yesterday" for the first hour of every
//      Moroccan morning, which misfiled stays, roll calls and escalations.
//   2. hostel_leave_passes.start_date_time / expected_return_at are
//      `timestamp without time zone` holding UTC wall clock, and Drizzle returns
//      them as 'YYYY-MM-DD HH:MM:SS' text. Comparing that text to
//      new Date().toISOString() compares ' 2...' against 'T2...', so a return
//      due later the same day sorted as already overdue.
//
// Same convention as the other audit suites: skipped unless DATABASE_URL is set.
import { describe, expect, it } from 'vitest';
import { casablancaTodayIso } from '@/libs/finance/today';
import { dateString, storedInstant } from '@/features/hostel/services/inventory-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Hostel date boundaries', () => {
  describe('storedInstant', () => {
    it('reads Postgres naive text as a UTC instant', () => {
      const d = storedInstant('2026-09-20 23:00:00');
      expect(d.toISOString()).toBe('2026-09-20T23:00:00.000Z');
    });

    it('keeps an offset that is already there instead of re-labelling it', () => {
      expect(storedInstant('2026-09-20T23:00:00.000Z').toISOString()).toBe('2026-09-20T23:00:00.000Z');
      expect(storedInstant('2026-09-21T00:00:00+01:00').toISOString()).toBe('2026-09-20T23:00:00.000Z');
    });

    it('does not flag a return due later today as overdue', () => {
      // A pass due three hours from now, stored the way Postgres hands it back.
      const dueLater = new Date(Date.now() + 3 * 3_600_000);
      const stored = dueLater.toISOString().replace('T', ' ').slice(0, 19);

      // The old comparison: always true for a same-day return.
      expect(stored < new Date().toISOString()).toBe(true);
      // The invariant: overdue only once the expected return instant has passed.
      expect(storedInstant(stored).getTime() < Date.now()).toBe(false);
    });

    it('does flag a return that is genuinely past due', () => {
      const pastDue = new Date(Date.now() - 3 * 3_600_000);
      const stored = pastDue.toISOString().replace('T', ' ').slice(0, 19);
      expect(storedInstant(stored).getTime() < Date.now()).toBe(true);
    });
  });

  describe('dateString', () => {
    it('is the Casablanca day, not the server or UTC day', () => {
      // 23:30 UTC is 00:30 the next day in Casablanca (UTC+1).
      const justPastMidnight = new Date('2026-09-20T23:30:00.000Z');
      expect(dateString(justPastMidnight)).toBe('2026-09-21');
      expect(dateString(justPastMidnight)).toBe(casablancaTodayIso(justPastMidnight));
    });

    it('stays on the same day an hour before Casablanca midnight', () => {
      const beforeMidnight = new Date('2026-09-20T21:30:00.000Z');
      expect(dateString(beforeMidnight)).toBe('2026-09-20');
    });
  });
});
