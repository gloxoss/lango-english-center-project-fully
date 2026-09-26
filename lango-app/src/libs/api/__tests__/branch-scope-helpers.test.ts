import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RequestContext } from '@/libs/api/context';

// Branch-scope foundation helpers (BRANCH-SCOPE-01 B1-03). branchWhere is the
// only way a route turns ctx.branchId into a WHERE term; assertWritableBranch
// is the only way a write accepts a branch. Everything else denies.

const { branchWhere, assertWritableBranch } = await import('@/libs/api/portal-scope');
const { branches, tenants, user } = await import('@/models/Schema');
const { db } = await import('@/libs/DB');

const hasDb = Boolean(process.env.DATABASE_URL);

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: 'usr-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    branchId: null,
    branchLocked: false,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Test',
    email: 'test@t.local',
    ...overrides,
  } as RequestContext;
}

describe('branchWhere', () => {
  it('returns an equality predicate when a branch is active', () => {
    expect(branchWhere(ctx({ branchId: '00000000-0000-0000-0000-000000000002' }), user.branchId)).toBeDefined();
  });

  it('returns undefined when no branch is active ("Tous les sites")', () => {
    expect(branchWhere(ctx({ branchId: null }), user.branchId)).toBeUndefined();
  });
});

describe.skipIf(!hasDb)('assertWritableBranch', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchInactive = crypto.randomUUID();
  const branchForeign = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Writable Branch Test', slug: `bwr-${suffix}` },
      { id: otherTenantId, name: 'Writable Branch Foreign', slug: `bwr-f-${suffix}` },
    ]);
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `BWA-${suffix}` },
      { id: branchInactive, tenantId, name: 'Closed', code: `BWI-${suffix}`, isActive: false },
      { id: branchForeign, tenantId: otherTenantId, name: 'Foreign', code: `BWF-${suffix}` },
    ]);
  });

  afterAll(async () => {
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('accepts a locked principal writing into their own branch', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId, branchId: branchA, branchLocked: true }), branchA),
    ).resolves.toBeUndefined();
  });

  it('refuses a locked principal writing into another branch', async () => {
    const branchB = crypto.randomUUID();
    await expect(
      assertWritableBranch(ctx({ tenantId, branchId: branchA, branchLocked: true }), branchB),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a locked principal writing without a branch', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId, branchId: branchA, branchLocked: true }), null),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('accepts a whole-school principal writing into an active branch of the tenant', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId }), branchA),
    ).resolves.toBeUndefined();
  });

  it('accepts a whole-school principal writing without a branch (caller decides DB4)', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId }), null),
    ).resolves.toBeUndefined();
  });

  it('refuses an inactive branch', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId }), branchInactive),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a branch of another tenant', async () => {
    await expect(
      assertWritableBranch(ctx({ tenantId }), branchForeign),
    ).rejects.toMatchObject({ status: 403 });
  });
});
