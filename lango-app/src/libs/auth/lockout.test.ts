import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkLockout,
  clearFailedLogins,
  enforceEmailPasswordLockout,
  LOCKOUT_MINUTES,
  lockoutRemainingMinutes,
  MAX_FAILED_LOGINS,
  recordFailedLogin,
  trackEmailPasswordResult,
} from '@/libs/auth/lockout';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

describe('Failed Login Lockout Helper Functions', () => {
  it('lockoutRemainingMinutes returns 0 when lockedUntil is null or past', () => {
    expect(lockoutRemainingMinutes(null)).toBe(0);

    const pastDate = new Date(Date.now() - 60_000).toISOString();

    expect(lockoutRemainingMinutes(pastDate)).toBe(0);
  });

  it('lockoutRemainingMinutes calculates remaining minutes correctly', () => {
    const futureDate = new Date(Date.now() + 10 * 60_000).toISOString();
    const remaining = lockoutRemainingMinutes(futureDate);

    expect(remaining).toBeGreaterThanOrEqual(9);
    expect(remaining).toBeLessThanOrEqual(10);
  });

  it('treats an offset-less PostgreSQL timestamp as UTC', () => {
    const utcWithoutOffset = new Date(Date.now() + 10 * 60_000)
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');
    const remaining = lockoutRemainingMinutes(utcWithoutOffset);

    expect(remaining).toBeGreaterThanOrEqual(9);
    expect(remaining).toBeLessThanOrEqual(10);
  });

  it('constants define 5 strikes and 15-minute lock policy', () => {
    expect(MAX_FAILED_LOGINS).toBe(5);
    expect(LOCKOUT_MINUTES).toBe(15);
  });
});

describe('Failed Login Lockout Authentication Hooks', () => {
  it('rejects a locked email sign-in with the public ACCOUNT_LOCKED code', async () => {
    const check = vi.fn().mockResolvedValue(7);

    await expect(enforceEmailPasswordLockout({
      path: '/sign-in/email',
      body: { email: 'user@test.local' },
      context: {},
    }, { checkLockout: check })).rejects.toMatchObject({
      body: { code: 'ACCOUNT_LOCKED' },
      status: 'TOO_MANY_REQUESTS',
    });
    expect(check).toHaveBeenCalledWith('user@test.local');
  });

  it('allows an unlocked email sign-in', async () => {
    const check = vi.fn().mockResolvedValue(0);

    await expect(enforceEmailPasswordLockout({
      path: '/sign-in/email',
      body: { email: 'user@test.local' },
      context: {},
    }, { checkLockout: check })).resolves.toBeUndefined();
  });

  it('records a failed email/password result when no session was created', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn().mockResolvedValue(undefined);

    await trackEmailPasswordResult({
      path: '/sign-in/email',
      body: { email: 'user@test.local' },
      context: { newSession: null },
    }, { clearFailedLogins: clear, recordFailedLogin: record });

    expect(record).toHaveBeenCalledWith('user@test.local');
    expect(clear).not.toHaveBeenCalled();
  });

  it('clears strikes after a successful email/password result', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn().mockResolvedValue(undefined);

    await trackEmailPasswordResult({
      path: '/sign-in/email',
      body: { email: 'user@test.local' },
      context: { newSession: { user: { id: 'user-1' } } },
    }, { clearFailedLogins: clear, recordFailedLogin: record });

    expect(clear).toHaveBeenCalledWith('user-1');
    expect(record).not.toHaveBeenCalled();
  });

  it('ignores unrelated authentication routes', async () => {
    const check = vi.fn().mockResolvedValue(10);
    const record = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn().mockResolvedValue(undefined);
    const ctx = { path: '/sign-out', body: { email: 'user@test.local' }, context: {} };

    await enforceEmailPasswordLockout(ctx, { checkLockout: check });
    await trackEmailPasswordResult(ctx, { clearFailedLogins: clear, recordFailedLogin: record });

    expect(check).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Failed Login Lockout PostgreSQL Integration', () => {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const testUserId = `LOCKOUT-${suffix}`;
  const testEmail = `lockout-${suffix}@test.local`;

  beforeEach(async () => {
    await db.insert(user).values({
      id: testUserId,
      name: 'Lockout Test User',
      email: testEmail,
    });
  });

  afterEach(async () => {
    await db.delete(user).where(eq(user.id, testUserId));
  });

  async function readState() {
    const [state] = await db
      .select({
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
        lastLogin: user.lastLogin,
      })
      .from(user)
      .where(eq(user.id, testUserId));
    return state!;
  }

  it('increments strikes and locks exactly on the fifth failed attempt', async () => {
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS - 1; attempt += 1) {
      await recordFailedLogin(testEmail.toUpperCase());
    }

    expect(await readState()).toMatchObject({ failedLoginCount: 4, lockedUntil: null });

    await recordFailedLogin(testEmail);
    const locked = await readState();

    expect(locked.failedLoginCount).toBe(5);
    expect(lockoutRemainingMinutes(locked.lockedUntil)).toBeGreaterThan(0);
    expect(await checkLockout(`  ${testEmail.toUpperCase()}  `)).toBeGreaterThan(0);
  });

  it('starts a fresh strike window after an expired lock', async () => {
    await db.update(user).set({
      failedLoginCount: MAX_FAILED_LOGINS,
      lockedUntil: new Date(Date.now() - 60_000).toISOString(),
    }).where(eq(user.id, testUserId));

    await recordFailedLogin(testEmail);

    expect(await readState()).toMatchObject({ failedLoginCount: 1, lockedUntil: null });
  });

  it('does not lose strikes when five failures arrive concurrently', async () => {
    await Promise.all(Array.from({ length: MAX_FAILED_LOGINS }, () => recordFailedLogin(testEmail)));

    const state = await readState();

    expect(state.failedLoginCount).toBe(MAX_FAILED_LOGINS);
    expect(lockoutRemainingMinutes(state.lockedUntil)).toBeGreaterThan(0);
  });

  it('clears strikes and the lock after successful authentication', async () => {
    await db.update(user).set({
      failedLoginCount: MAX_FAILED_LOGINS,
      lockedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
    }).where(eq(user.id, testUserId));

    await clearFailedLogins(testUserId);

    const state = await readState();

    expect(state.failedLoginCount).toBe(0);
    expect(state.lockedUntil).toBeNull();
    expect(state.lastLogin).not.toBeNull();
  });

  it('does not fail or create state for an unknown email', async () => {
    await expect(recordFailedLogin(`unknown-${suffix}@test.local`)).resolves.toBeUndefined();
    await expect(checkLockout(`unknown-${suffix}@test.local`)).resolves.toBe(0);
    expect(await readState()).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  });
});
