// Entitlement / licence expiry boundary (AUD-PLATFORM-01).
//
// `expiresAt` arrives in two shapes and they mean different things:
//
//   - a DATE-ONLY string ('2026-12-31', what the entitlement and licence screens
//     submit through z.iso.date()) names a day the customer paid through. The old
//     check compared it as an instant, and `new Date('2026-12-31')` is UTC
//     midnight, so a module switched off at 00:00 on the last paid day - a school
//     paying through 31 Dec lost ~23 hours of it.
//   - a value carrying a TIME is an exact instant and must be honoured to the
//     second (the licence worker tests expire a licence 1 second ago).
//
// The gate (entitlements.isActive) and the suspension worker must agree, or a
// tenant gets suspended while requireAddon still lets it in. `deriveLicenseStatus`
// had a third, separately-derived rule and showed 'expired' on the last paid day
// while access still worked; it now shares the same rule.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveLicenseStatus } from '@/features/subscriptions/services/subscription-service';
import { isActive, isExpiredAt } from '@/libs/api/entitlements';
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

  it('honours a full timestamp to the second', () => {
    // The licence worker issues instants; this shape must not be rounded to a day.
    expect(isExpiredAt('2026-06-30T23:00:00.000Z', new Date('2026-06-30T22:59:00.000Z'))).toBe(false);
    expect(isExpiredAt('2026-06-30T23:00:00.000Z', new Date('2026-06-30T23:00:01.000Z'))).toBe(true);
  });

  it('normalises a naive time-bearing expiry to UTC', () => {
    // A time with no offset is read by `new Date` as SERVER-LOCAL, which moves
    // the cut-off by the host offset. Writers today send date-only or Z-suffixed
    // values, so this is defensive rather than a live bug.
    expect(isExpiredAt('2026-06-30 23:00:00', new Date('2026-06-30T22:59:00.000Z'))).toBe(false);
    expect(isExpiredAt('2026-06-30 23:00:00', new Date('2026-06-30T23:00:01.000Z'))).toBe(true);
  });

  it('agrees with the licence status the UI shows', () => {
    // deriveLicenseStatus had its own instant comparison and reported 'expired'
    // on the customer's last paid day while the gate still granted access.
    const onLastPaidDay = { status: 'active', expiresAt: today };
    const past = { status: 'active', expiresAt: addDays(today, -1) };

    expect(deriveLicenseStatus(onLastPaidDay)).not.toBe('expired');
    expect(isActive({ isEnabled: true, expiresAt: today })).toBe(true);
    expect(deriveLicenseStatus(past)).toBe('expired');
    expect(isActive({ isEnabled: true, expiresAt: addDays(today, -1) })).toBe(false);
  });

  it('keeps the suspension worker on the same rule as the gate', () => {
    // The worker must not derive its own expiry rule; it calls isExpiredAt.
    const src = fs.readFileSync(WORKER, 'utf8');

    expect(src).toContain('isExpiredAt(');
    expect(src).not.toContain('casablancaTodayIso()');
  });
});
