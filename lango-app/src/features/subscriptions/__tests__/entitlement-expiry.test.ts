// Entitlement / licence expiry boundary (AUD-PLATFORM-01).
//
// `expiresAt` is written from the entitlement and licence screens as a DATE-ONLY
// string (`z.iso.date()`), so it names a day the customer paid through. The old
// check compared it as an instant:
//
//     new Date('2026-12-31').getTime() > Date.now()
//
// `new Date('2026-12-31')` is UTC midnight, so the module switched off at 00:00
// on the last paid day — a school paying through 31 Dec lost access for ~23
// hours of it. The licence suspension worker had the same cut-off but derived it
// differently (a UTC instant compared against a naive timestamp column), so the
// two could disagree on a non-UTC host.
//
// The platform reads "today" as the Casablanca school day
// (libs/finance/today.ts), so expiry is now inclusive of that whole day and both
// paths share one rule.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isActive } from '@/libs/api/entitlements';
import { casablancaTodayIso } from '@/libs/finance/today';

const WORKER = path.resolve(
  process.cwd(),
  'src/features/subscriptions/services/license-expiry-worker.ts',
);

describe('Entitlement expiry boundary', () => {
  const today = casablancaTodayIso();

  function addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  it('is active through the whole of its expiry day', () => {
    // The core fix: a licence naming today is still paid-for today.
    expect(isActive({ isEnabled: true, expiresAt: today })).toBe(true);
  });

  it('is inactive once the expiry day has passed', () => {
    expect(isActive({ isEnabled: true, expiresAt: addDays(today, -1) })).toBe(false);
    expect(isActive({ isEnabled: true, expiresAt: addDays(today, -30) })).toBe(false);
  });

  it('is active before its expiry day', () => {
    expect(isActive({ isEnabled: true, expiresAt: addDays(today, 1) })).toBe(true);
    expect(isActive({ isEnabled: true, expiresAt: addDays(today, 365) })).toBe(true);
  });

  it('never treats a disabled row as active, whatever the date', () => {
    expect(isActive({ isEnabled: false, expiresAt: null })).toBe(false);
    expect(isActive({ isEnabled: false, expiresAt: addDays(today, 365) })).toBe(false);
    expect(isActive({ isEnabled: false, expiresAt: addDays(today, -1) })).toBe(false);
  });

  it('treats a null expiry as open-ended', () => {
    expect(isActive({ isEnabled: true, expiresAt: null })).toBe(true);
  });

  it('tolerates a full timestamp as well as a date-only value', () => {
    // The column is a timestamp; if anything ever writes a time, the rule still
    // means "valid through the end of that day".
    expect(isActive({ isEnabled: true, expiresAt: `${today}T23:59:59.000Z` })).toBe(true);
  });

  it('suspends licences on the same rule the gate uses', () => {
    // The worker must not derive a UTC instant that cuts off a day early, and it
    // must agree with isActive so a tenant is never suspended while the gate
    // still says the module is on.
    const src = fs.readFileSync(WORKER, 'utf8');

    // The worker must not derive its own expiry rule; it calls the same
    // isExpiredAt the gate uses.
    expect(src).toContain('isExpiredAt(');
    expect(src).not.toContain('casablancaTodayIso()');
    expect(src).not.toContain('.toISOString().slice(0, 10)');
  });
});
