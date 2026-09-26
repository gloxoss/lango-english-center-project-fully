import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Branch-scope foundation (BRANCH-SCOPE-01 B1-01): the context separates
// "chosen" from "locked". A locked staff principal keeps their assigned branch
// no matter what is stored; a whole-school staff principal gets their stored
// choice only when it is an ACTIVE branch of their own tenant; patron roles
// are never branch-filtered, even with a stray user.branchId.

let currentSessionUserId: string | null = null;
let currentSessionId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId
        ? { user: { id: currentSessionUserId }, session: { id: currentSessionId } }
        : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { branches, portalActiveContexts, session, tenants, user } = await import('@/models/Schema');
const { resolveActiveContext } = await import('@/features/portal/services/active-context');
const { requireRequestContext } = await import('@/libs/api/context');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('branch context resolution (B1-01)', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const branchA = crypto.randomUUID(); // active, this tenant
  const branchB = crypto.randomUUID(); // active, this tenant
  const branchInactive = crypto.randomUUID(); // inactive, this tenant
  const branchForeign = crypto.randomUUID(); // active, other tenant

  const lockedTeacherId = `USR-BC-LOCKED-${suffix}`;
  const adminId = `USR-BC-ADMIN-${suffix}`;
  const parentId = `USR-BC-PARENT-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Branch Context Test', slug: `bctx-${suffix}` },
      { id: otherTenantId, name: 'Branch Context Foreign', slug: `bctx-f-${suffix}` },
    ]);
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `BCA-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `BCB-${suffix}` },
      { id: branchInactive, tenantId, name: 'Closed', code: `BCC-${suffix}`, isActive: false },
      { id: branchForeign, tenantId: otherTenantId, name: 'Foreign', code: `BCF-${suffix}` },
    ]);
    await db.insert(user).values([
      // Locked staff: branch assignment A is a hard lock.
      { id: lockedTeacherId, tenantId, name: 'Locked Teacher', email: `bctx-locked-${suffix}@t.local`, role: 'teacher', userStatus: 'active', branchId: branchA },
      // Whole-school staff: no branch, may choose any active branch.
      { id: adminId, tenantId, name: 'Director', email: `bctx-admin-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      // Parent with a stray branch assignment: never branch-filtered.
      { id: parentId, tenantId, name: 'Parent', email: `bctx-parent-${suffix}@t.local`, role: 'parent', userStatus: 'active', branchId: branchA },
    ]);
  });

  afterAll(async () => {
    await db.delete(portalActiveContexts).where(eq(portalActiveContexts.tenantId, tenantId));
    await db.delete(session).where(like(session.id, `sess-${suffix}%`));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  // portal_active_contexts.session_id is an FK to the better-auth session
  // table, so every fake session id needs a real session row.
  async function storeContext(sessionId: string, userId: string, activeRole: string, activeBranchId: string | null) {
    const now = new Date();
    await db.insert(session).values({
      id: sessionId,
      userId,
      token: `${sessionId}-token`,
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(portalActiveContexts).values({
      sessionId,
      userId,
      tenantId,
      activeRole,
      activeBranchId,
    });
  }

  async function contextFor(sessionId: string, userId: string) {
    currentSessionUserId = userId;
    currentSessionId = sessionId;
    try {
      return await requireRequestContext(new Request('http://localhost/api/anything'));
    } finally {
      currentSessionUserId = null;
      currentSessionId = null;
    }
  }

  it('keeps a locked user on their own branch even when another is stored', async () => {
    const sessionId = `sess-${suffix}-locked-foreign`;
    await storeContext(sessionId, lockedTeacherId, 'teacher', branchB);
    const ctx = await contextFor(sessionId, lockedTeacherId);
    expect(ctx.branchId).toBe(branchA);
    expect(ctx.branchLocked).toBe(true);
    // The stale stored choice is cleared (self-heal), not kept.
    const [row] = await db
      .select({ activeBranchId: portalActiveContexts.activeBranchId })
      .from(portalActiveContexts)
      .where(eq(portalActiveContexts.sessionId, sessionId));
    expect(row?.activeBranchId).toBeNull();
  });

  it('keeps a locked user on their own branch when their own branch is stored', async () => {
    const sessionId = `sess-${suffix}-locked-own`;
    await storeContext(sessionId, lockedTeacherId, 'teacher', branchA);
    const ctx = await contextFor(sessionId, lockedTeacherId);
    expect(ctx.branchId).toBe(branchA);
    expect(ctx.branchLocked).toBe(true);
  });

  it('gives a whole-school admin their stored branch with branchLocked=false', async () => {
    const sessionId = `sess-${suffix}-admin-choice`;
    await storeContext(sessionId, adminId, 'school_admin', branchB);
    const ctx = await contextFor(sessionId, adminId);
    expect(ctx.branchId).toBe(branchB);
    expect(ctx.branchLocked).toBe(false);
  });

  it('falls back to no branch for a whole-school admin with no stored choice', async () => {
    const ctx = await contextFor(`sess-${suffix}-admin-none`, adminId);
    expect(ctx.branchId).toBeNull();
    expect(ctx.branchLocked).toBe(false);
  });

  it('drops a stored branch that belongs to another tenant', async () => {
    const sessionId = `sess-${suffix}-admin-foreign`;
    await storeContext(sessionId, adminId, 'school_admin', branchForeign);
    const ctx = await contextFor(sessionId, adminId);
    expect(ctx.branchId).toBeNull();
  });

  it('drops a stored branch that is inactive', async () => {
    const sessionId = `sess-${suffix}-admin-inactive`;
    await storeContext(sessionId, adminId, 'school_admin', branchInactive);
    const ctx = await contextFor(sessionId, adminId);
    expect(ctx.branchId).toBeNull();
  });

  it('never branch-filters a parent, even with user.branchId set', async () => {
    // No stored context: the base-role fallback must also yield null.
    const ctx = await contextFor(`sess-${suffix}-parent-fallback`, parentId);
    expect(ctx.role).toBe('parent');
    expect(ctx.branchId).toBeNull();
    expect(ctx.branchLocked).toBe(false);
  });

  it('drops the stored branch of a parent context', async () => {
    const sessionId = `sess-${suffix}-parent-stored`;
    await storeContext(sessionId, parentId, 'parent', branchA);
    const ctx = await contextFor(sessionId, parentId);
    expect(ctx.branchId).toBeNull();
    expect(ctx.branchLocked).toBe(false);
  });

  it('super_admin: resolveActiveContext refuses any stored context (unchanged)', async () => {
    const superId = `USR-BC-SUPER-${suffix}`;
    // Real super-admins carry no branch assignment; platform context is
    // tenant-scoped by cookie, not by campus. B1 leaves this path unchanged.
    await db.insert(user).values({
      id: superId, tenantId, name: 'Super', email: `bctx-super-${suffix}@t.local`, role: 'super_admin', userStatus: 'active',
    });
    try {
      const sessionId = `sess-${suffix}-super`;
      await storeContext(sessionId, superId, 'super_admin', branchB);
      const ctx = await contextFor(sessionId, superId);
      expect(ctx.role).toBe('super_admin');
      expect(ctx.branchId).toBeNull();
      expect(ctx.branchLocked).toBe(false);
    } finally {
      // Sessions/context rows reference the user; clear them first.
      await db.delete(portalActiveContexts).where(eq(portalActiveContexts.tenantId, tenantId));
      await db.delete(session).where(eq(session.userId, superId));
      await db.delete(user).where(eq(user.id, superId));
    }
  });

  it('resolveActiveContext alone reports branchLocked for a locked principal', async () => {
    const sessionId = `sess-${suffix}-direct`;
    await storeContext(sessionId, lockedTeacherId, 'teacher', null);
    const resolved = await resolveActiveContext(sessionId, {
      id: lockedTeacherId,
      tenantId,
      baseRole: 'teacher',
      branchId: branchA,
    });
    expect(resolved?.activeRole).toBe('teacher');
    expect(resolved?.activeBranchId).toBeNull();
    expect(resolved?.branchLocked).toBe(true);
  });
});
