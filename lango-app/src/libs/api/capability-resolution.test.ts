import { describe, expect, it, vi } from 'vitest';

// Rows the fake db should return, set per-test.
const state: {
  userOverride: { granted: boolean } | null;
  roleOverride: { granted: boolean } | null;
} = { userOverride: null, roleOverride: null };

vi.mock('@/libs/env/server', () => ({
  serverEnv: { DATABASE_URL: 'postgresql://x/y', BETTER_AUTH_SECRET: 'x'.repeat(32) },
}));

vi.mock('@/models/Schema', () => ({
  userPermissionOverrides: { __table: 'user_overrides' },
  rolePermissions: { __table: 'role_permissions' },
}));

vi.mock('@/libs/DB', () => ({
  db: {
    select: () => ({
      from: (table: { __table: string }) => ({
        where: () => ({
          limit: () => Promise.resolve(
            table.__table === 'user_overrides'
              ? (state.userOverride ? [state.userOverride] : [])
              : (state.roleOverride ? [state.roleOverride] : []),
          ),
        }),
      }),
    }),
  },
}));

const { hasCapability } = await import('./permissions');

// The three-layer resolution (user override -> tenant role override -> default)
// is the whole authorization decision. Each layer must be able to say "no",
// not only "yes" - a grant-only layer silently ignores every revocation.
describe('hasCapability resolution order', () => {
  const ask = () => hasCapability('u1', 't1', 'teacher', 'students.read');

  it('falls back to the role default when nothing is overridden', async () => {
    state.userOverride = null;
    state.roleOverride = null;

    // teacher has students.read by default
    await expect(ask()).resolves.toBe(true);
  });

  it('lets a tenant revoke a permission the role has by default', async () => {
    state.userOverride = null;
    state.roleOverride = { granted: false };

    await expect(ask()).resolves.toBe(false);
  });

  it('lets a tenant grant a permission the role lacks by default', async () => {
    state.userOverride = null;
    state.roleOverride = { granted: true };

    await expect(hasCapability('u1', 't1', 'teacher', 'students.delete')).resolves.toBe(true);
  });

  it('user override beats the tenant role override', async () => {
    state.userOverride = { granted: true };
    state.roleOverride = { granted: false };

    await expect(ask()).resolves.toBe(true);

    state.userOverride = { granted: false };
    state.roleOverride = { granted: true };

    await expect(ask()).resolves.toBe(false);
  });

  it('super_admin bypasses every lookup', async () => {
    state.userOverride = { granted: false };
    state.roleOverride = { granted: false };

    await expect(hasCapability('u1', 't1', 'super_admin', 'students.delete')).resolves.toBe(true);
  });
});
