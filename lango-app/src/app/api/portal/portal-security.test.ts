import { beforeEach, describe, expect, it, vi } from 'vitest';

// Queue-based DB mock: each `.limit()` resolves to the next queued result.
// This lets each test drive exactly what hasGuardianIdentity / the context
// read / a search query returns, without asserting on SQL shape.
// Hoisted so the vi.mock factory below can reference the chain without hitting
// the temporal-dead-zone (the factory runs before the top-level `const`s).
const { dbChain, dbQueue } = vi.hoisted(() => {
  const dbQueue: unknown[][] = [[]];
  const dbChain: Record<string, any> = {
    select: () => dbChain,
    from: () => dbChain,
    innerJoin: () => dbChain,
    where: () => dbChain,
    orderBy: () => dbChain,
    limit: async () => dbQueue.shift() ?? [],
    insert: () => dbChain,
    values: () => dbChain,
    update: () => dbChain,
    set: () => dbChain,
    delete: () => dbChain,
    catch: () => dbChain,
  };
  return { dbChain, dbQueue };
});
vi.mock('@/libs/DB', () => ({ db: dbChain }));

// `@/libs/auth` runs listApprovedDomains() during module init (trustedOrigins
// for the session). With the DB mocked as a chain, `rows.map` on that chain
// throws a TypeError into stderr — mock the service so the suite has clean
// stderr and auth init resolves to an empty domain list.
vi.mock('@/features/platform/services/domains-service', () => ({
  listApprovedDomains: vi.fn().mockResolvedValue([]),
}));

/** Replace the queued result of the next `.limit()` call. */
function setQueue(results: unknown[]): void {
  dbQueue.splice(0, dbQueue.length, results);
}

/** Queue one result per sequential `.limit()` call. */
function setQueueSequence(seq: unknown[][]): void {
  dbQueue.splice(0, dbQueue.length, ...seq);
}

import {
  isRoleAssignable,
  listAvailableRoles,
  resolveActiveContext,
} from '@/features/portal/services/active-context';
import {
  assertBranchScope,
  assertSelf,
  denyUnless,
  requireTenantId,
} from '@/libs/api/portal-scope';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { searchPortal } from '@/features/portal/services/portal-search';
import { setPortalPreference } from '@/features/portal/services/portal-preferences';

function expectForbidden(fn: () => void): void {
  try {
    fn();
    expect.unreachable('expected ApiError');
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(403);
  }
}

describe('Role Portals Foundation — authorization primitives', () => {
  beforeEach(() => {
    setQueue([]);
  });

  describe('isRoleAssignable', () => {
    it('base role is always assignable', async () => {
      expect(await isRoleAssignable('T1', 'teacher', 'u1', 'teacher')).toBe(true);
    });

    it('super_admin cannot switch into any other role', async () => {
      expect(await isRoleAssignable('T1', 'super_admin', 'u1', 'school_admin')).toBe(false);
    });

    it('parent is assignable only when a live guardian identity exists', async () => {
      setQueue([{ id: 'guardian-1' }]);
      expect(await isRoleAssignable('T1', 'student', 'u1', 'parent')).toBe(true);

      setQueue([]);
      expect(await isRoleAssignable('T1', 'student', 'u1', 'parent')).toBe(false);
    });

    it('refuses a derived parent role when no effective guardian relationship resolves', async () => {
      setQueue([]);
      expect(await isRoleAssignable('T1', 'teacher', 'u1', 'parent')).toBe(false);
    });

    it('arbitrary target roles are refused', async () => {
      expect(await isRoleAssignable('T1', 'student', 'u1', 'teacher')).toBe(false);
      expect(await isRoleAssignable('T1', 'accountant', 'u1', 'super_admin')).toBe(false);
      expect(await isRoleAssignable('T1', 'guard', 'u1', 'librarian')).toBe(false);
    });
  });

  describe('listAvailableRoles', () => {
    it('returns base role plus parent when a guardian identity exists', async () => {
      setQueue([{ id: 'guardian-1' }]);
      expect(await listAvailableRoles('T1', 'student', 'u1')).toEqual(['student', 'parent']);
    });

    it('returns only the base role without a derived identity', async () => {
      setQueue([]);
      expect(await listAvailableRoles('T1', 'teacher', 'u1')).toEqual(['teacher']);
    });

    it('tenantless principal gets only the base role', async () => {
      expect(await listAvailableRoles(null, 'school_admin', 'u1')).toEqual(['school_admin']);
    });
  });

  describe('resolveActiveContext', () => {
    it('returns null when no context row exists (base role fallback)', async () => {
      setQueue([]);
      expect(await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: null })).toBeNull();
    });

    it('returns null for super_admin (never has an active context)', async () => {
      expect(await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'super_admin', branchId: null })).toBeNull();
    });

    it('refuses a stored role that is no longer assignable and drops the stale row', async () => {
      // select: stored active context claims parent; guardian lookup returns
      // nothing → parent is no longer assignable → stale context refused.
      setQueueSequence([
        [{ userId: 'u1', activeRole: 'parent', activeBranchId: null, tenantId: 'T1' }],
        [],
      ]);
      const ctx = await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: null });
      expect(ctx).toBeNull();
    });

    it('refuses a context row bound to another tenant', async () => {
      setQueue([{ userId: 'u1', activeRole: 'student', activeBranchId: null, tenantId: 'T-OTHER' }]);
      expect(await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: null })).toBeNull();
    });

    it('refuses a context row bound to another user and drops it (P0)', async () => {
      // Same session id, but the stored row's user_id belongs to someone else
      // (forged/tampered row) → refused, never honored, row dropped.
      setQueue([{ userId: 'OTHER-USER', activeRole: 'student', activeBranchId: null, tenantId: 'T1' }]);
      expect(await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: null })).toBeNull();
    });

    it('clears a stored active branch that is not the principal authoritative branch (P1)', async () => {
      setQueue([{ userId: 'u1', activeRole: 'student', activeBranchId: 'B1', tenantId: 'T1' }]);
      const ctx = await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: 'B2' });
      expect(ctx).toEqual({ activeRole: 'student', activeBranchId: null });
    });

    it('clears a stored active branch when the principal has no authoritative branch (P1)', async () => {
      setQueue([{ userId: 'u1', activeRole: 'student', activeBranchId: 'B1', tenantId: 'T1' }]);
      const ctx = await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: null });
      expect(ctx).toEqual({ activeRole: 'student', activeBranchId: null });
    });

    it('clears a stored active branch that no longer exists in the tenant (P1)', async () => {
      // select: context claims B1, which equals the authoritative branch, but
      // the branches tenant-ownership lookup returns nothing → cleared.
      setQueueSequence([
        [{ userId: 'u1', activeRole: 'student', activeBranchId: 'B1', tenantId: 'T1' }],
        [],
      ]);
      const ctx = await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: 'B1' });
      expect(ctx).toEqual({ activeRole: 'student', activeBranchId: null });
    });

    it('keeps a stored active branch that matches the authoritative assignment and tenant', async () => {
      setQueueSequence([
        [{ userId: 'u1', activeRole: 'student', activeBranchId: 'B1', tenantId: 'T1' }],
        [{ id: 'B1' }],
      ]);
      const ctx = await resolveActiveContext('sess-1', { id: 'u1', tenantId: 'T1', baseRole: 'student', branchId: 'B1' });
      expect(ctx).toEqual({ activeRole: 'student', activeBranchId: 'B1' });
    });
  });

  describe('portal preferences (key allowlist)', () => {
    it('rejects an unknown preference key before touching the DB', async () => {
      await expect(setPortalPreference('T1', 'u1', 'evilKey', { x: 1 })).rejects.toBeInstanceOf(ApiError);
      await expect(setPortalPreference('T1', 'u1', 'evilKey', { x: 1 })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_PREFERENCE_KEY',
      });
    });
  });

  describe('portal scope helpers (deny by default)', () => {
    const baseCtx = { userId: 'u1', tenantId: 'T1', branchId: null, role: 'student', baseRole: 'student', name: 'A', email: 'a@t', sessionId: 's' } as const;

    it('requireTenantId throws without a tenant', () => {
      expectForbidden(() => requireTenantId({ ...baseCtx, tenantId: null }));
    });
    it('requireTenantId returns the tenant when present', () => {
      expect(requireTenantId(baseCtx)).toBe('T1');
    });

    it('assertSelf allows the owner, denies everyone else', () => {
      expect(() => assertSelf(baseCtx, 'u1')).not.toThrow();
      expectForbidden(() => assertSelf(baseCtx, 'u2'));
    });

    it('assertBranchScope denies cross-branch when a branch is active', () => {
      expect(() => assertBranchScope({ ...baseCtx, branchId: 'B1' }, 'B1')).not.toThrow();
      expectForbidden(() => assertBranchScope({ ...baseCtx, branchId: 'B1' }, 'B2'));
      expect(() => assertBranchScope({ ...baseCtx, branchId: null }, 'B2')).not.toThrow();
    });

    it('denyUnless fails closed', () => {
      expect(() => denyUnless(true)).not.toThrow();
      expectForbidden(() => denyUnless(false));
    });
  });

  describe('portal search scoping', () => {
    it('parent sees only linked children (relationship scope)', async () => {
      setQueue([{ id: 's1', name: 'Ali', email: 'ali@t', matricule: 'M1' }]);
      const ctx: RequestContext = { userId: 'parent-1', tenantId: 'T1', branchId: null, role: 'parent', baseRole: 'parent', name: 'P', email: 'p@t' };
      const result = await searchPortal(ctx, 'Ali');
      expect(result.students).toHaveLength(1);
      expect(result.students[0]).toEqual({ id: 's1', name: 'Ali', email: 'ali@t', matricule: 'M1' });
      // No finance/HR/sensitive fields on the projection.
      expect(Object.keys(result.students[0] ?? {}).sort()).toEqual(['email', 'id', 'matricule', 'name']);
      expect(result.teachers).toHaveLength(0);
      expect(result.invoices).toHaveLength(0);
    });

    it('parent sees no students when no effective relationship matches', async () => {
      setQueue([]);
      const ctx: RequestContext = { userId: 'parent-1', tenantId: 'T1', branchId: null, role: 'parent', baseRole: 'parent', name: 'P', email: 'p@t' };
      const result = await searchPortal(ctx, 'Ali');
      expect(result.students).toEqual([]);
    });

    it('student sees only themselves', async () => {
      setQueue([{ id: 'u1', name: 'Me', email: 'me@t', matricule: 'M9' }]);
      const ctx: RequestContext = { userId: 'u1', tenantId: 'T1', branchId: null, role: 'student', baseRole: 'student', name: 'Me', email: 'me@t' };
      const result = await searchPortal(ctx, 'Me');
      expect(result.students).toHaveLength(1);
      expect(result.students[0]?.id).toBe('u1');
    });

    it('student never matches another student', async () => {
      setQueue([]);
      const ctx: RequestContext = { userId: 'u1', tenantId: 'T1', branchId: null, role: 'student', baseRole: 'student', name: 'Me', email: 'me@t' };
      const result = await searchPortal(ctx, 'Ali');
      expect(result.students).toHaveLength(0);
    });
  });
});
