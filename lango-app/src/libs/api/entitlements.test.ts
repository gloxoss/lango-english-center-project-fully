import { describe, expect, it } from 'vitest';
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
  it('accepts a registry id and rejects anything else', () => {
    expect(() => assertKnownAddon('library')).not.toThrow();
    expect(() => assertKnownAddon('not-a-real-addon')).toThrow();
  });

  // POST /api/settings/branches gates on this exact id. A rename in the
  // registry would silently turn that gate into a permanent denial.
  it('knows the multi-branch addon the branches route gates on', () => {
    expect(() => assertKnownAddon('multi-branch')).not.toThrow();
  });
});
