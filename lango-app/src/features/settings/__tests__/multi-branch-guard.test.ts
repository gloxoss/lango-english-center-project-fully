// Multi-branch entitlement guard (POST /api/settings/branches) + tenant isolation.
//
// Unlike every other addon, multi-branch is soft-gated: a tenant without the
// addon may still hold exactly one (default) branch - route.ts uses `hasAddon`,
// not `requireAddon`. The addon only blocks *going past* the first branch.
// This test proves that boundary directly, plus that branches never leak
// across tenants (registry.ts's own description: "the only addon actually
// built and gated today").
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { addonEntitlements, branches, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

const { requireRequestContext } = vi.hoisted(() => ({ requireRequestContext: vi.fn() }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext,
  requireTenant: (ctx: { tenantId?: string | null }) => {
    if (!ctx.tenantId) throw new Error('TENANT_REQUIRED');
    return ctx.tenantId;
  },
}));

const { POST: createBranch, GET: listBranches } = await import('@/app/api/settings/branches/route');

describe.skipIf(!dbReachable)('multi-branch entitlement guard + isolation', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `MB-ADMIN-A-${suffix}`;
  const adminB = `MB-ADMIN-B-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Branch Tenant A ${suffix}`, slug: `mb-a-${suffix}` },
      { id: tenantB, name: `Branch Tenant B ${suffix}`, slug: `mb-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Branch Admin A', email: `mb-admin-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: adminB, tenantId: tenantB, name: 'Branch Admin B', email: `mb-admin-b-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
    ]);
  }, 30_000);

  afterAll(async () => {
    await db.delete(branches).where(eq(branches.tenantId, tenantA));
    await db.delete(branches).where(eq(branches.tenantId, tenantB));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  function asAdmin(tenantId: string, userId: string) {
    requireRequestContext.mockResolvedValue({
      userId,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Branch Admin',
      email: `${userId}@test.local`,
    });
  }

  function createRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/settings/branches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('allows the first (default) branch even without the multi-branch addon entitled', async () => {
    asAdmin(tenantA, adminA);
    const res = await createBranch(createRequest({ name: 'Campus Principal', code: `MAIN-${suffix}` }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isDefault).toBe(true);
  });

  it('blocks a second branch with ADDON_REQUIRED while the addon is not entitled', async () => {
    asAdmin(tenantA, adminA);
    const res = await createBranch(createRequest({ name: 'Campus Secondaire', code: `SEC-${suffix}` }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('ADDON_REQUIRED');
  });

  it('allows a second branch once the multi-branch addon is entitled', async () => {
    await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'multi-branch', isEnabled: true });
    await db.update(tenants).set({ maxBranches: 5 }).where(eq(tenants.id, tenantA));

    asAdmin(tenantA, adminA);
    const res = await createBranch(createRequest({ name: 'Campus Secondaire', code: `SEC-${suffix}` }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isDefault).toBe(false);
  });

  it('never leaks tenant A branches to tenant B', async () => {
    asAdmin(tenantB, adminB);
    const res = await listBranches(new Request('http://localhost/api/settings/branches'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(0);
  });
});
