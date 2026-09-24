// Business-date regression suite (AUD-LIBINV-01).
//
// A loan's due date, "is this overdue?", "is this issue late?", and the default
// order/sale/return dates are all calendar-day decisions. The school's calendar
// day is the Casablanca one (libs/finance/today.ts), not the server's UTC day.
//
// The bug this prevents: deriving today with `new Date().toISOString().slice(0,10)`
// answers "yesterday" for the first hour of every Moroccan morning, so a book
// borrowed then was dated a day early and its due date came back a day short,
// while overdue lists lit up an hour before the item was actually due.
//
// Static sweep of both modules so a new call site fails the build.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { casablancaTodayIso } from '@/libs/finance/today';

const MODULES = [
  path.resolve(process.cwd(), 'src/features/library'),
  path.resolve(process.cwd(), 'src/features/inventory'),
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}
const rel = (p: string) => path.relative(process.cwd(), p).split(path.sep).join('/');

describe('Library/Inventory business date', () => {
  it('is the Casablanca day across the midnight edge', () => {
    // 23:30 UTC is 00:30 the next day in Casablanca (UTC+1).
    const justPastMoroccanMidnight = new Date('2026-09-20T23:30:00.000Z');
    expect(justPastMoroccanMidnight.toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(casablancaTodayIso(justPastMoroccanMidnight)).toBe('2026-09-21');
  });

  it('agrees with the UTC day for most of the working day', () => {
    const midday = new Date('2026-09-20T12:00:00.000Z');
    expect(casablancaTodayIso(midday)).toBe('2026-09-20');
  });

  it('never derives a business date from the UTC ISO string in either module', () => {
    const offenders = MODULES
      .flatMap(sourceFiles)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /\.toISOString\(\)\.slice\(0,\s*10\)/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it('routes day arithmetic through the shared helper', () => {
    // Both modules must call the one definition of "today" that finance and
    // attendance already use, so the whole platform agrees on the school day.
    for (const mod of MODULES) {
      const users = sourceFiles(mod)
        .filter((f) => !/\.test\.tsx?$/.test(f))
        .filter((f) => fs.readFileSync(f, 'utf8').includes('casablancaTodayIso()'));
      expect(users.length, `${rel(mod)} should use casablancaTodayIso()`).toBeGreaterThan(0);
    }
  });
});
