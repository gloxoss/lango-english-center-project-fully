import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// BRANCH-SCOPE-01 W1 wave tests — students directory + attendance mode.
// Canonical 5 cases on representative W1 routes (plan B4): locked sees own;
// chosen sees own; "Tous" sees all; parity sum holds; locked cannot create
// into another branch (+ DB4 refuses guessed campuses).

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
const { branches, classes, portalActiveContexts, session, tenants, user } = await import('@/models/Schema');
const studentsRoute = await import('@/app/api/students/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('W1 branch scope — students directory', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();

  const lockedAdminId = `USR-W1-LOCKED-${suffix}`; // school_admin hard-locked to A
  const adminId = `USR-W1-ADMIN-${suffix}`; // whole-school
  const students = [
    { id: `USR-W1-S-A1-${suffix}`, branchId: branchA },
    { id: `USR-W1-S-A2-${suffix}`, branchId: branchA },
    { id: `USR-W1-S-B1-${suffix}`, branchId: branchB },
  ];

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'W1 Branch Test', slug: `w1-${suffix}` });
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `W1A-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `W1B-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: lockedAdminId, tenantId, name: 'Locked Admin', email: `w1-locked-${suffix}@t.local`, role: 'school_admin', userStatus: 'active', branchId: branchA },
      { id: adminId, tenantId, name: 'Director', email: `w1-admin-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      ...students.map(s => ({
        id: s.id, tenantId, name: `Student ${s.id.slice(-4)}`, email: `${s.id.toLowerCase()}@t.local`,
        role: 'student' as const, userStatus: 'active' as const, branchId: s.branchId,
      })),
    ]);
  });

  afterAll(async () => {
    await db.delete(portalActiveContexts).where(eq(portalActiveContexts.tenantId, tenantId));
    await db.delete(session).where(like(session.id, `sess-w1-${suffix}%`));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function call(userId: string, sessionId: string, url: string) {
    currentSessionUserId = userId;
    currentSessionId = sessionId;
    try {
      return await studentsRoute.GET(new Request(url));
    } finally {
      currentSessionUserId = null;
      currentSessionId = null;
    }
  }

  async function listIds(ctxUserId: string, sessId: string): Promise<string[]> {
    const res = await call(ctxUserId, sessId, 'http://localhost/api/students');
    expect(res.status).toBe(200);
    const json = await res.json();
    return (json.data as Array<{ id: string }>).map(s => s.id).sort();
  }

  it('1. a locked admin sees only their own campus', async () => {
    const ids = await listIds(lockedAdminId, `sess-w1-${suffix}-1`);
    expect(ids).toEqual([students[0]!.id, students[1]!.id].sort());
  });

  it('2. a whole-school admin with a chosen campus sees only it', async () => {
    const sessId = `sess-w1-${suffix}-2`;
    const now = new Date();
    await db.insert(session).values({
      id: sessId, userId: adminId, token: `${sessId}-t`, expiresAt: new Date(now.getTime() + 3_600_000), createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(portalActiveContexts).values({
      sessionId: sessId, userId: adminId, tenantId, activeRole: 'school_admin', activeBranchId: branchB,
    });
    const ids = await listIds(adminId, sessId);
    expect(ids).toEqual([students[2]!.id]);
  });

  it('3. "Tous les sites" (no stored choice) sees all campuses', async () => {
    const ids = await listIds(adminId, `sess-w1-${suffix}-3`);
    expect(ids).toHaveLength(3);
  });

  it('4. parity: per-branch counts + unassigned = all (3 = 2 + 1 + 0)', async () => {
    const all = await listIds(adminId, `sess-w1-${suffix}-4`);
    const inA = all.filter(id => students.some(s => s.id === id && s.branchId === branchA)).length;
    const inB = all.filter(id => students.some(s => s.id === id && s.branchId === branchB)).length;
    const unassigned = all.length - inA - inB;
    expect(inA + inB + unassigned).toBe(all.length);
    expect(inA).toBe(2);
    expect(inB).toBe(1);
  });

  it('5a. a locked admin cannot create into another campus (403)', async () => {
    currentSessionUserId = lockedAdminId;
    currentSessionId = `sess-w1-${suffix}-5`;
    try {
      const res = await studentsRoute.POST(new Request('http://localhost/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'Test Eleve', branchId: branchB }),
      }));
      expect(res.status).toBe(403);
    } finally {
      currentSessionUserId = null;
      currentSessionId = null;
    }
  });

  it('5b. DB4: whole-school admin without campus and without class is refused (422)', async () => {
    currentSessionUserId = adminId;
    currentSessionId = `sess-w1-${suffix}-6`;
    try {
      const res = await studentsRoute.POST(new Request('http://localhost/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'Test Eleve' }),
      }));
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error?.code).toBe('BRANCH_REQUIRED');
    } finally {
      currentSessionUserId = null;
      currentSessionId = null;
    }
  });
});
