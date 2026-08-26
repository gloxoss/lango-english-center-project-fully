import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const sessionUserId = { value: null as string | null };

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId.value
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-test' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

const { requireRequestContext } = await import('@/libs/api/context');

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('subscription enforcement gate', () => {
  const tenantId = crypto.randomUUID();
  const suffix = Date.now();
  const adminId = `GATE-ADMIN-${suffix}`;
  const teacherId = `GATE-TEACHER-${suffix}`;
  const superAdminId = `GATE-SUPER-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Gate Test School',
      slug: `gate-test-${tenantId}`,
      subscriptionStatus: 'suspended',
      isActive: true,
    });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Gate Admin', email: `gate-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: teacherId, tenantId, name: 'Gate Teacher', email: `gate-teacher-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: superAdminId, tenantId: null, name: 'Gate Super', email: `gate-super-${suffix}@test.local`, role: 'super_admin', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.id, superAdminId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  const dummyRequest = new Request('http://localhost/api/test', { method: 'GET' });

  it.each([
    ['school_admin', adminId],
    ['teacher', teacherId],
  ])('returns 402 SUBSCRIPTION_SUSPENDED for %s when tenant is suspended', async (_role, userId) => {
    sessionUserId.value = userId;
    await expect(requireRequestContext(dummyRequest)).rejects.toMatchObject({
      status: 402,
      code: 'SUBSCRIPTION_SUSPENDED',
    });
  });

  it('allows super_admin through even when the tenant is suspended', async () => {
    sessionUserId.value = superAdminId;
    const ctx = await requireRequestContext(dummyRequest);
    expect(ctx.role).toBe('super_admin');
  });

  it.each(['past_due', 'unpaid', 'canceled', 'cancelled'] as const)(
    'blocks school_admin when subscription status is "%s"',
    async (status) => {
      await db.update(tenants).set({ subscriptionStatus: status }).where(eq(tenants.id, tenantId));
      sessionUserId.value = adminId;
      await expect(requireRequestContext(dummyRequest)).rejects.toMatchObject({
        status: 402,
        code: 'SUBSCRIPTION_SUSPENDED',
      });
    },
  );

  it('allows school_admin through when subscription status is active', async () => {
    await db.update(tenants).set({ subscriptionStatus: 'active' }).where(eq(tenants.id, tenantId));
    sessionUserId.value = adminId;
    const ctx = await requireRequestContext(dummyRequest);
    expect(ctx.role).toBe('school_admin');
  });

  it('allows school_admin through when allowSuspended opt is set', async () => {
    await db.update(tenants).set({ subscriptionStatus: 'suspended' }).where(eq(tenants.id, tenantId));
    sessionUserId.value = adminId;
    const ctx = await requireRequestContext(dummyRequest, undefined, { allowSuspended: true });
    expect(ctx.role).toBe('school_admin');
  });
});
