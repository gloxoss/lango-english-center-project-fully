import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// POST /api/portal/branch (BRANCH-SCOPE-01 B1-02): the campus choice is stored
// server-side per session. Locked staff can never move off their branch, a
// whole-school staff principal can pick any ACTIVE branch of their own tenant
// or null, patrons are refused, and the active role is kept unchanged.

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
const { POST } = await import('@/app/api/portal/branch/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('POST /api/portal/branch', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();
  const branchInactive = crypto.randomUUID();
  const branchForeign = crypto.randomUUID();

  const lockedTeacherId = `USR-PB-LOCKED-${suffix}`;
  const adminId = `USR-PB-ADMIN-${suffix}`;
  const parentId = `USR-PB-PARENT-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Portal Branch Test', slug: `pb-${suffix}` },
      { id: otherTenantId, name: 'Portal Branch Foreign', slug: `pb-f-${suffix}` },
    ]);
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `PBA-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `PBB-${suffix}` },
      { id: branchInactive, tenantId, name: 'Closed', code: `PBC-${suffix}`, isActive: false },
      { id: branchForeign, tenantId: otherTenantId, name: 'Foreign', code: `PBF-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: lockedTeacherId, tenantId, name: 'Locked Teacher', email: `pb-locked-${suffix}@t.local`, role: 'teacher', userStatus: 'active', branchId: branchA },
      { id: adminId, tenantId, name: 'Director', email: `pb-admin-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      { id: parentId, tenantId, name: 'Parent', email: `pb-parent-${suffix}@t.local`, role: 'parent', userStatus: 'active', branchId: branchA },
    ]);
  });

  afterAll(async () => {
    await db.delete(portalActiveContexts).where(eq(portalActiveContexts.tenantId, tenantId));
    await db.delete(session).where(like(session.id, `sess-pb-${suffix}%`));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  // portal_active_contexts.session_id is an FK to the better-auth session
  // table, so every fake session id needs a real session row.
  async function ensureSession(sessionId: string, userId: string) {
    const now = new Date();
    await db.insert(session).values({
      id: sessionId,
      userId,
      token: `${sessionId}-token`,
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  function post(body: unknown, userId: string, sessionId: string) {
    currentSessionUserId = userId;
    currentSessionId = sessionId;
    return ensureSession(sessionId, userId).then(() =>
      POST(new Request('http://localhost/api/portal/branch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })),
    ).finally(() => {
      currentSessionUserId = null;
      currentSessionId = null;
    });
  }

  async function storedBranch(sessionId: string): Promise<string | null> {
    const [row] = await db
      .select({ activeBranchId: portalActiveContexts.activeBranchId, activeRole: portalActiveContexts.activeRole })
      .from(portalActiveContexts)
      .where(eq(portalActiveContexts.sessionId, sessionId));
    return row ? row.activeBranchId : null;
  }

  it('rejects a locked user picking another branch with 403', async () => {
    const res = await post({ branchId: branchB }, lockedTeacherId, `sess-pb-${suffix}-1`);
    expect(res.status).toBe(403);
    expect(await storedBranch(`sess-pb-${suffix}-1`)).toBeNull();
  });

  it('lets a locked user re-affirm their own branch (idempotent)', async () => {
    const res = await post({ branchId: branchA }, lockedTeacherId, `sess-pb-${suffix}-2`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ branchId: branchA, locked: true });
    expect(await storedBranch(`sess-pb-${suffix}-2`)).toBe(branchA);
  });

  it('stores a whole-school admin\'s choice of an active branch of the tenant', async () => {
    const sessionId = `sess-pb-${suffix}-3`;
    const res = await post({ branchId: branchB }, adminId, sessionId);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ branchId: branchB, locked: false });
    expect(await storedBranch(sessionId)).toBe(branchB);
  });

  it('drops a branch of another tenant with 403', async () => {
    const sessionId = `sess-pb-${suffix}-4`;
    const res = await post({ branchId: branchForeign }, adminId, sessionId);
    expect(res.status).toBe(403);
    expect(await storedBranch(sessionId)).toBeNull();
  });

  it('drops an inactive branch with 403', async () => {
    const sessionId = `sess-pb-${suffix}-5`;
    const res = await post({ branchId: branchInactive }, adminId, sessionId);
    expect(res.status).toBe(403);
    expect(await storedBranch(sessionId)).toBeNull();
  });

  it('stores null ("Tous les sites") for a whole-school admin', async () => {
    const sessionId = `sess-pb-${suffix}-6`;
    const res = await post({ branchId: null }, adminId, sessionId);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ branchId: null, locked: false });
    expect(await storedBranch(sessionId)).toBeNull();
  });

  it('keeps the active role unchanged when switching branch', async () => {
    const sessionId = `sess-pb-${suffix}-7`;
    await ensureSession(sessionId, adminId);
    await db.insert(portalActiveContexts).values({
      sessionId,
      userId: adminId,
      tenantId,
      activeRole: 'school_admin',
      activeBranchId: null,
    });
    const res = await post({ branchId: branchA }, adminId, sessionId);
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ activeRole: portalActiveContexts.activeRole, activeBranchId: portalActiveContexts.activeBranchId })
      .from(portalActiveContexts)
      .where(eq(portalActiveContexts.sessionId, sessionId));
    expect(row?.activeRole).toBe('school_admin');
    expect(row?.activeBranchId).toBe(branchA);
  });

  it('refuses a parent with 403 (patrons are never branch-filtered)', async () => {
    const res = await post({ branchId: branchA }, parentId, `sess-pb-${suffix}-8`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated call with 401', async () => {
    currentSessionUserId = null;
    currentSessionId = null;
    const res = await POST(new Request('http://localhost/api/portal/branch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branchId: null }),
    }));
    expect(res.status).toBe(401);
  });

  it('rejects extra body keys (strict schema) with 422', async () => {
    const res = await post({ branchId: null, role: 'school_admin' }, adminId, `sess-pb-${suffix}-9`);
    expect(res.status).toBe(422);
  });
});
