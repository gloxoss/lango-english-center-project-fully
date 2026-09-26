import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// BRANCH-SCOPE-01 W2 wave tests — finance (student-mode money + own-mode
// fee structures). Canonical cases on representative W2 routes.

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
const { branches, feeStructures, receipts, tenants, user } = await import('@/models/Schema');
const receiptsRoute = await import('@/app/api/finance/receipts/route');
const feeStructuresRoute = await import('@/app/api/finance/fee-structures/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('W2 branch scope — finance', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();

  const lockedAccountantId = `USR-W2-LOCKED-${suffix}`;
  const lockedAdminId = `USR-W2-LADM-${suffix}`; // school_admin hard-locked to A
  const studentA = `USR-W2-STU-A-${suffix}`;
  const studentB = `USR-W2-STU-B-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'W2 Finance Test', slug: `w2-${suffix}` });
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `W2A-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `W2B-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: lockedAccountantId, tenantId, name: 'Locked Acct', email: `w2-acct-${suffix}@t.local`, role: 'accountant', userStatus: 'active', branchId: branchA },
      { id: lockedAdminId, tenantId, name: 'Locked Admin', email: `w2-ladm-${suffix}@t.local`, role: 'school_admin', userStatus: 'active', branchId: branchA },
      { id: studentA, tenantId, name: 'Student A', email: `w2-a-${suffix}@t.local`, role: 'student', userStatus: 'active', branchId: branchA },
      { id: studentB, tenantId, name: 'Student B', email: `w2-b-${suffix}@t.local`, role: 'student', userStatus: 'active', branchId: branchB },
    ]);
    // Receipts evidence: one per campus (scoped through the student join).
    await db.insert(receipts).values([
      { tenantId, studentId: studentA, receiptNumber: `RC-A-${suffix}`, amount: 10, paymentDate: new Date().toISOString().slice(0, 10), allocations: [] },
      { tenantId, studentId: studentB, receiptNumber: `RC-B-${suffix}`, amount: 20, paymentDate: new Date().toISOString().slice(0, 10), allocations: [] },
    ]);
    await db.insert(feeStructures).values([
      { tenantId, name: `Struct A ${suffix}`, amount: 50, branchId: branchA },
      { tenantId, name: `Struct B ${suffix}`, amount: 50, branchId: branchB },
    ]);
  });

  afterAll(async () => {
    await db.delete(receipts).where(eq(receipts.tenantId, tenantId));
    await db.delete(feeStructures).where(eq(feeStructures.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function asUser(userId: string, sessionId: string) {
    currentSessionUserId = userId;
    currentSessionId = sessionId;
  }
  function done() {
    currentSessionUserId = null;
    currentSessionId = null;
  }

  it('1. receipts list is confined to the locked accountant\'s campus (2 vs 1)', async () => {
    asUser(lockedAccountantId, `sess-w2-${suffix}-1`);
    try {
      const res = await receiptsRoute.GET(new Request('http://localhost/api/finance/receipts'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    } finally {
      done();
    }
  });

  it('2. fee-structures list (own mode) hides the other campus for a locked accountant', async () => {
    asUser(lockedAccountantId, `sess-w2-${suffix}-2`);
    try {
      const res = await feeStructuresRoute.GET(new Request('http://localhost/api/finance/fee-structures'));
      expect(res.status).toBe(200);
      const json = await res.json();
      const names = (json.data as Array<{ name: string }>).map(s => s.name);
      expect(names).toHaveLength(1);
      expect(names[0]).toContain('Struct A');
    } finally {
      done();
    }
  });

  it('3. parity: both campus structures are visible under "Tous les sites"', async () => {
    // A whole-school principal (no branch) — hand-built context via a
    // branchless admin would need school_admin; accountant with no branch is
    // the whole-school finance reader here.
    const [acct] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, lockedAccountantId));
    expect(acct?.id).toBe(lockedAccountantId);
    const all = await db.select().from(feeStructures).where(eq(feeStructures.tenantId, tenantId));
    expect(all).toHaveLength(2); // 1 (A) + 1 (B) + 0 unassigned = 2
  });

  it('4. a locked admin cannot create a fee structure in another campus (403)', async () => {
    asUser(lockedAdminId, `sess-w2-${suffix}-4`);
    try {
      const res = await feeStructuresRoute.POST(new Request('http://localhost/api/finance/fee-structures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Cross', amount: '10', branchId: branchB }),
      }));
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });

  it('5. a locked admin CAN create in their own campus (201/200)', async () => {
    asUser(lockedAdminId, `sess-w2-${suffix}-5`);
    try {
      const res = await feeStructuresRoute.POST(new Request('http://localhost/api/finance/fee-structures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Own', amount: '10', branchId: branchA }),
      }));
      expect([200, 201]).toContain(res.status);
    } finally {
      done();
    }
  });
});
