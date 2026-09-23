import { describe, expect, it } from 'vitest';
import { resolveAddonForPath, stripLocalePrefix } from '@/libs/api/page-guard-path';

// Audit 2026-09-22 P1-1: the add-on gate normalized locale-prefixed paths with
// `/^\/[a-z]{2}(\/|$)/`, turning `/fr/dashboard/hostel` into
// `//dashboard/hostel`, which matched NO add-on prefix — the entitlement gate
// never fired for any locale-prefixed URL (i.e. all of them, since middleware
// always prefixes dashboard URLs).

describe('stripLocalePrefix', () => {
  it('strips /fr, /ar and /en exactly once on a segment boundary', () => {
    expect(stripLocalePrefix('/fr/dashboard/hostel')).toBe('/dashboard/hostel');
    expect(stripLocalePrefix('/ar/dashboard/library')).toBe('/dashboard/library');
    expect(stripLocalePrefix('/en/dashboard/workforce')).toBe('/dashboard/workforce');
    expect(stripLocalePrefix('/dashboard/hostel')).toBe('/dashboard/hostel');
  });

  it('keeps the locale when it is the whole path', () => {
    expect(stripLocalePrefix('/fr')).toBe('');
    expect(stripLocalePrefix('/ar')).toBe('');
    expect(stripLocalePrefix('/en')).toBe('');
  });

  it('does not mangle segments that merely start with two letters', () => {
    expect(stripLocalePrefix('/franken-dashboard/hostel')).toBe('/franken-dashboard/hostel');
    expect(stripLocalePrefix('/fr-x/dashboard')).toBe('/fr-x/dashboard');
  });
});

describe('resolveAddonForPath — locale-prefixed dashboard URLs', () => {
  it('resolves the hostel addon on /fr/dashboard/hostel', () => {
    expect(resolveAddonForPath('/fr/dashboard/hostel')).toBe('hostel');
  });

  it('resolves the hostel addon on nested locale paths like /fr/dashboard/hostel/rooms', () => {
    expect(resolveAddonForPath('/fr/dashboard/hostel/rooms')).toBe('hostel');
  });

  it('resolves the library addon on /ar/dashboard/library', () => {
    expect(resolveAddonForPath('/ar/dashboard/library')).toBe('library');
  });

  it('resolves the payroll-workforce addon on /en/dashboard/workforce', () => {
    expect(resolveAddonForPath('/en/dashboard/workforce/payroll/runs')).toBe('payroll-workforce');
  });

  it('resolves addons on bare (unprefixed) paths too', () => {
    expect(resolveAddonForPath('/dashboard/hostel')).toBe('hostel');
    expect(resolveAddonForPath('/dashboard/inventory/stock')).toBe('inventory');
  });

  it('never produces a double-slash path that matches nothing (regression)', () => {
    // The old regex produced '//dashboard/hostel' here.
    const normalized = stripLocalePrefix('/fr/dashboard/hostel');
    expect(normalized.startsWith('//')).toBe(false);
    expect(resolveAddonForPath('/fr/dashboard/hostel')).not.toBeNull();
  });

  it('returns null for non add-on pages', () => {
    expect(resolveAddonForPath('/fr/dashboard/students')).toBeNull();
    expect(resolveAddonForPath('/fr/dashboard')).toBeNull();
    expect(resolveAddonForPath('/fr/dashboard/academics/exams')).toBeNull();
  });

  it('respects prefix boundaries — /dashboard/hr does not swallow other routes', () => {
    expect(resolveAddonForPath('/fr/dashboard/hr')).toBe('human-resources');
    expect(resolveAddonForPath('/fr/dashboard/hrxyz')).toBeNull();
  });
});
