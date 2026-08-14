import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '@/libs/api/context';

// Drive route-level tests (POST rollback) through a real session lookup.
let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user, settingValues, settingValueVersions } = await import('@/models/Schema');
const { setSettingValue } = await import('./registry');

const hasDb = Boolean(process.env.DATABASE_URL);

function ctx(tenantId: string, userId: string, role: 'school_admin' = 'school_admin', branchId: string | null = null): RequestContext {
  return { userId, tenantId, branchId, role, baseRole: role, name: 'Test Admin', email: 'admin@test.local' };
}

describe.skipIf(!hasDb)('setSettingValue transaction & concurrency (P1-6)', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const branchAId = crypto.randomUUID();
  const branchBId = crypto.randomUUID();
  const adminId = `CONC-ADMIN-${suffix}`;
  const key = 'security.sessionTimeoutMinutes';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Concurrency Tenant', slug: `conc-${suffix}` });
    await db.insert(user).values({
      id: adminId, tenantId, name: 'Concurrency Admin',
      email: `conc-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantId));
    await db.delete(user).where(eq(user.id, adminId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('returns v1 on first write and records one version row', async () => {
    const c = ctx(tenantId, adminId);
    const v = await setSettingValue(tenantId, null, key, 30, c, 'initial');
    expect(v).toBe(1);

    const [valueRow] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), isNull(settingValues.branchId), eq(settingValues.key, key),
    )).limit(1);
    expect(valueRow!.version).toBe(1);
    expect(valueRow!.value).toBe(30);

    const versions = await db.select().from(settingValueVersions)
      .where(eq(settingValueVersions.settingValueId, valueRow!.id));
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
  });

  it('two concurrent PATCHes with the same expectedVersion: one commits, one 409, no lost update', async () => {
    // Race both callers from the current base version (1): the CAS must let
    // exactly one through and reject the other with 409.
    const c = ctx(tenantId, adminId);
    const results = await Promise.allSettled([
      setSettingValue(tenantId, null, key, 45, c, 'race A', 1),
      setSettingValue(tenantId, null, key, 60, c, 'race B', 1),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ status: 409 });

    // Exactly one winner, no lost update: final version = 2, value = winner.
    const [valueRow] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), isNull(settingValues.branchId), eq(settingValues.key, key),
    )).limit(1);
    expect(valueRow!.version).toBe(2);
    expect(valueRow!.value).toBe(fulfilled[0]!.value === 2 ? 45 : 60);

    // History is gapless: versions 1,2 each exactly once.
    const versions = await db.select({ version: settingValueVersions.version })
      .from(settingValueVersions)
      .where(eq(settingValueVersions.settingValueId, valueRow!.id));
    expect(versions.map(v => v.version).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('stale expectedVersion is rejected with 409', async () => {
    // Current version is now 2; claiming base 1 must 409 and write nothing.
    await expect(
      setSettingValue(tenantId, null, key, 99, ctx(tenantId, adminId), 'stale', 1),
    ).rejects.toMatchObject({ status: 409 });

    const [valueRow] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), isNull(settingValues.branchId), eq(settingValues.key, key),
    )).limit(1);
    expect(valueRow!.version).toBe(2);
    expect(valueRow!.value).toBe(45);
  });

  it('concurrent first inserts converge to a single row with gapless history', async () => {
    // Postgres UNIQUE treats NULL as distinct, so (tenant, NULL, key) rows are
    // not deduplicated by the constraint. The advisory lock must serialize the
    // two writers so the store converges to exactly one row.
    const freshKey = 'security.dismissedAlerts'; // unused tenant key
    const c = ctx(tenantId, adminId);
    const results = await Promise.allSettled([
      setSettingValue(tenantId, null, freshKey, ['a'], c, 'insert A'),
      setSettingValue(tenantId, null, freshKey, ['b'], c, 'insert B'),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(2); // serialized: A writes v1, B writes v2

    const rows = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), isNull(settingValues.branchId), eq(settingValues.key, freshKey),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.version).toBe(2);

    const versions = await db.select({ version: settingValueVersions.version })
      .from(settingValueVersions)
      .where(eq(settingValueVersions.settingValueId, rows[0]!.id));
    expect(versions.map(v => v.version).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('branch writes never touch the tenant-global or sibling-branch rows', async () => {
    const branchKey = 'organization.city';
    const cA = ctx(tenantId, adminId, 'school_admin', branchAId);
    const cB = ctx(tenantId, adminId, 'school_admin', branchBId);

    await setSettingValue(tenantId, branchAId, branchKey, 'Casablanca', cA, 'branch A');
    await setSettingValue(tenantId, branchBId, branchKey, 'Rabat', cB, 'branch B');

    const rows = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), eq(settingValues.key, branchKey),
    ));
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.branchId === branchAId)!.value).toBe('Casablanca');
    expect(rows.find(r => r.branchId === branchBId)!.value).toBe('Rabat');
  });
});

describe.skipIf(!hasDb)('POST /api/settings/values/[key] rollback scoping (P1-5)', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const branchAId = crypto.randomUUID();
  const branchBId = crypto.randomUUID();
  const adminAId = `RB-ADMIN-A-${suffix}`;
  const adminBId = `RB-ADMIN-B-${suffix}`;
  const adminGlobalId = `RB-ADMIN-G-${suffix}`;
  const key = 'organization.city';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Rollback Tenant', slug: `rb-${suffix}` });
    // The route derives the authoritative branch scope from the authenticated
    // user's own row (user.branchId) — a client-supplied ?branchId= is never
    // honored. Each scope under test therefore needs its own principal.
    await db.insert(user).values([
      { id: adminAId, tenantId, branchId: branchAId, name: 'Rollback Admin A', email: `rb-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: adminBId, tenantId, branchId: branchBId, name: 'Rollback Admin B', email: `rb-b-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: adminGlobalId, tenantId, branchId: null, name: 'Rollback Admin G', email: `rb-g-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
    ]);
    // Branch A history: versions 1..2 ; Branch B history: versions 1..3.
    const cA = ctx(tenantId, adminAId, 'school_admin', branchAId);
    const cB = ctx(tenantId, adminBId, 'school_admin', branchBId);
    await setSettingValue(tenantId, branchAId, key, 'Casablanca', cA, 'A1');
    await setSettingValue(tenantId, branchAId, key, 'Miami', cA, 'A2');
    await setSettingValue(tenantId, branchBId, key, 'Rabat', cB, 'B1');
    await setSettingValue(tenantId, branchBId, key, 'Tanger', cB, 'B2');
    await setSettingValue(tenantId, branchBId, key, 'Fes', cB, 'B3');
  });

  afterAll(async () => {
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function rollback(userId: string, targetVersion: number): Promise<Response> {
    currentSessionUserId = userId;
    const { POST } = await import('@/app/api/settings/values/[key]/route');
    const url = new URL(`http://localhost/api/settings/values/${key}`);
    return POST(new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetVersion }),
    }), { params: Promise.resolve({ key }) });
  }

  it('branch A cannot roll back to a version that only exists in branch B history', async () => {
    // Branch A has versions {1,2}; 3 only exists in Branch B. Old code would
    // have resolved it from the first (tenant,key) row it found.
    const res = await rollback(adminAId, 3);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('VERSION_NOT_FOUND');
  });

  it('tenant-global scope cannot roll back when no global row exists', async () => {
    // No tenant-global (branch_id IS NULL) row exists for this key; a
    // global-scoped principal must 404 rather than resolving from a branch row.
    const res = await rollback(adminGlobalId, 1);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('VERSION_NOT_FOUND');
  });

  it('a version that exists in the request scope rolls back correctly', async () => {
    // Branch A versions {1,2}; rollback to version 1 (Casablanca) creates v3.
    const res = await rollback(adminAId, 1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.version).toBe(3);
    expect(body.data.rolledBackTo).toBe(1);

    const [rowA] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), eq(settingValues.branchId, branchAId), eq(settingValues.key, key),
    )).limit(1);
    expect(rowA!.value).toBe('Casablanca');
    expect(rowA!.version).toBe(3);

    // Sibling branch B is untouched.
    const [rowB] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), eq(settingValues.branchId, branchBId), eq(settingValues.key, key),
    )).limit(1);
    expect(rowB!.value).toBe('Fes');
    expect(rowB!.version).toBe(3);
  });

  it('stale expectedVersion on PATCH is 409 with no history written', async () => {
    currentSessionUserId = adminBId;
    const { PATCH } = await import('@/app/api/settings/values/[key]/route');
    const url = new URL(`http://localhost/api/settings/values/${key}`);
    const res = await PATCH(new Request(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'Agadir', expectedVersion: 1 }),
    }), { params: Promise.resolve({ key }) });
    expect(res.status).toBe(409);

    // History must be gapless: branch B still exactly {1,2,3}.
    const [rowB] = await db.select().from(settingValues).where(and(
      eq(settingValues.tenantId, tenantId), eq(settingValues.branchId, branchBId), eq(settingValues.key, key),
    )).limit(1);
    const versions = await db.select({ version: settingValueVersions.version })
      .from(settingValueVersions)
      .where(eq(settingValueVersions.settingValueId, rowB!.id));
    expect(versions.map(v => v.version).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(rowB!.value).toBe('Fes');
  });
});
