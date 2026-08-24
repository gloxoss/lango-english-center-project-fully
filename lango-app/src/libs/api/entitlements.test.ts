import { describe, expect, it, vi } from 'vitest';

// `assertKnownAddon` now reads the DB-driven addon catalog. The unit test
// doesn't spin up a DB, so we stub the catalog behind a known set of ids.
vi.mock('./addon-catalog', () => {
  const known = new Set(['library', 'multi-branch', 'human-resources', 'payroll-workforce']);
  return {
    getAddonDefinition: async (id: string) =>
      known.has(id) ? { id, name: id, description: '', enabled: true, requires: [] } : undefined,
    listAddonDefinitions: async () =>
      [...known].map((id) => ({ id, name: id, description: '', enabled: true, requires: [] })),
  };
});

import { assertKnownAddon, isActive } from './entitlements';

// The security-relevant branch: an entitlement must deny when disabled OR
// expired, and only allow when enabled AND (perpetual OR future expiry).
describe('entitlement isActive', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it('allows enabled + no expiry', () => {
    expect(isActive({ isEnabled: true, expiresAt: null })).toBe(true);
  });

  it('allows enabled + future expiry', () => {
    expect(isActive({ isEnabled: true, expiresAt: future })).toBe(true);
  });

  it('denies expired even when enabled', () => {
    expect(isActive({ isEnabled: true, expiresAt: past })).toBe(false);
  });

  it('denies disabled even when unexpired (kill switch)', () => {
    expect(isActive({ isEnabled: false, expiresAt: future })).toBe(false);
    expect(isActive({ isEnabled: false, expiresAt: null })).toBe(false);
  });
});

describe('assertKnownAddon', () => {
  it('accepts a registry id and rejects anything else', async () => {
    await expect(assertKnownAddon('library')).resolves.toBeUndefined();
    await expect(assertKnownAddon('not-a-real-addon')).rejects.toThrow();
  });

  // POST /api/settings/branches gates on this exact id. A rename in the
  // registry would silently turn that gate into a permanent denial.
  it('knows the multi-branch addon the branches route gates on', async () => {
    await expect(assertKnownAddon('multi-branch')).resolves.toBeUndefined();
  });
});
