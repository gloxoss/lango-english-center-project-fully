import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  minutesOf,
  REGISTER_CLOSES_AFTER_MINUTES,
  REGISTER_OPENS_BEFORE_MINUTES,
  registerWindow,
} from '@/libs/attendance/register-window';
import {
  registerWindow as registerWindowFromOccurrence,
} from '@/libs/attendance/session-occurrence';

// The register window is asked about from two sides that cannot share a file:
// the server (Appel du jour, the teacher's current lesson, the QR scan path) and
// the teacher's register, which runs in the browser. The rule was moved into a
// database-free module so the browser could import it, and session-occurrence
// re-exports it.
//
// What is worth pinning is not the arithmetic (attendance-session-occurrence
// already covers that) but the two properties that make the move safe: there is
// still exactly ONE implementation, and that implementation stays importable by
// a Client Component. A future edit that copies the rule back, or that reaches
// for the database from it, breaks the register screen in a way no route test
// would ever see.

const MODULE_PATH = path.join(process.cwd(), 'src', 'libs', 'attendance', 'register-window.ts');

describe('register window: one implementation, browser-importable', () => {
  it('is re-exported by session-occurrence, not redefined there', () => {
    // Identity, not equality: a copy would pass a value comparison on the cases
    // this suite happens to try and fail on the one it does not.
    expect(registerWindowFromOccurrence).toBe(registerWindow);
  });

  it('imports nothing that reads the database', () => {
    const source = fs.readFileSync(MODULE_PATH, 'utf8');
    const imports = [...source.matchAll(/^import[^;]+from\s+'([^']+)';$/gm)].map(m => m[1]);

    // `session-occurrence.ts` pulls in Drizzle and `pg` at module scope. Importing
    // it from a Client Component drags `net` and `util/types` into the browser
    // bundle, which Next does not polyfill, and the build fails. Anything added
    // here has to stay free of the database, which means exactly one import of a
    // module that has no imports at all.
    expect(imports).toEqual(['@/libs/finance/today']);
  });

  it('keeps the approved boundaries: opens 5 minutes early, closes 15 minutes late', () => {
    expect(REGISTER_OPENS_BEFORE_MINUTES).toBe(5);
    expect(REGISTER_CLOSES_AFTER_MINUTES).toBe(15);

    const lesson = { startTime: '14:00', endTime: '15:00' };

    // The school day is Casablanca's, so the assertions run through an instant
    // whose Casablanca wall clock reads the time being tested.
    const at = (hm: string) => {
      const [hours, minutes] = hm.split(':').map(Number) as [number, number];
      const utc = new Date(Date.UTC(2026, 9, 6, hours, minutes, 0, 0));
      return new Date(utc.getTime() - casablancaOffsetAt(utc));
    };

    expect(registerWindow(lesson, '2026-10-06', at('13:54'))).toBe('BEFORE');
    expect(registerWindow(lesson, '2026-10-06', at('13:55'))).toBe('OPEN');
    expect(registerWindow(lesson, '2026-10-06', at('15:15'))).toBe('OPEN');
    expect(registerWindow(lesson, '2026-10-06', at('15:16'))).toBe('CLOSED');
    // A past day is closed in full, a future one has not opened.
    expect(registerWindow(lesson, '2026-10-05', at('14:00'))).toBe('CLOSED');
    expect(registerWindow(lesson, '2026-10-07', at('14:00'))).toBe('BEFORE');
  });

  it('parses a stored "HH:MM" slot time', () => {
    expect(minutesOf('00:00')).toBe(0);
    expect(minutesOf('14:05')).toBe(845);
  });
});

/**
 * Casablanca's UTC offset (ms) at `instant`. Two-pass, so the hour the offset
 * changes still resolves; the same approach `libs/finance/today.ts` takes.
 */
function casablancaOffsetAt(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(instant).map(part => [part.type, part.value]),
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}
