import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// BRANCH-SCOPE-01 c1/c2 tests — the core-module routes scoped in this pass
// (hr dossier family, online payments, report-card issuance). Canonical case
// for each module: a locked user must not read or write another campus's row.

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
const { addonEntitlements, branches, employeeProfiles, invoices, tenants, user } = await import('@/models/Schema');
const employeeRoute = await import('@/app/api/hr/employees/[id]/route');
const paymentsOnlineRoute = await import('@/app/api/finance/payments/online/route');
const reportCardIssueRoute = await import('@/app/api/students/report-card/issue/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('c1 branch scope — hr, online payments, report cards', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();

  const lockedAdminId = `USR-C1-LADM-${suffix}`; // school_admin hard-locked to A
  const lockedAcctId = `USR-C1-ACCT-${suffix}`; // accountant hard-locked to A
  const employeeBId = `USR-C1-EMP-B-${suffix}`;
  const studentB = `USR-C1-STU-B-${suffix}`;
  const employeeProfileId = crypto.randomUUID();
  const invoiceBId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'C1 Core Test', slug: `c1-${suffix}` });
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `C1A-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `C1B-${suffix}` },
    ]);
    await db.insert(addonEntitlements).values([
      { tenantId, addonId: 'human-resources', isEnabled: true },
    ]);
    await db.insert(user).values([
      { id: lockedAdminId, tenantId, name: 'Locked Admin', email: `c1-ladm-${suffix}@t.local`, role: 'school_admin', userStatus: 'active', branchId: branchA },
      { id: lockedAcctId, tenantId, name: 'Locked Acct', email: `c1-acct-${suffix}@t.local`, role: 'accountant', userStatus: 'active', branchId: branchA },
      { id: employeeBId, tenantId, name: 'Employee B', email: `c1-emp-b-${suffix}@t.local`, role: 'teacher', userStatus: 'active', branchId: branchB },
      { id: studentB, tenantId, name: 'Student B', email: `c1-stu-b-${suffix}@t.local`, role: 'student', userStatus: 'active', branchId: branchB },
    ]);
    await db.insert(employeeProfiles).values({
      id: employeeProfileId,
      tenantId,
      userId: employeeBId,
      employeeId: `EMP-C1-${suffix}`,
      firstName: 'Employee',
      lastName: 'B',
      branchId: branchB,
    });
    await db.insert(invoices).values({
      id: invoiceBId,
      tenantId,
      studentId: studentB,
      invoiceNumber: `INV-C1-${suffix}`,
      amount: 100,
      netAmount: 100,
      paidAmount: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
    });
  });

  afterAll(async () => {
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(employeeProfiles).where(eq(employeeProfiles.tenantId, tenantId));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
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

  it('1. hr: a locked admin cannot read another campus dossier (403)', async () => {
    asUser(lockedAdminId, `sess-c1-${suffix}-1`);
    try {
      const res = await employeeRoute.GET(new Request(`http://localhost/api/hr/employees/${employeeProfileId}`), { params: Promise.resolve({ id: employeeProfileId }) });
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });

  it('2. hr: a locked admin cannot PATCH another campus dossier (403)', async () => {
    asUser(lockedAdminId, `sess-c1-${suffix}-2`);
    try {
      const res = await employeeRoute.PATCH(new Request(`http://localhost/api/hr/employees/${employeeProfileId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '0600000000' }),
      }), { params: Promise.resolve({ id: employeeProfileId }) });
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });

  it('3. hr: the locked admin still reads their own campus dossier (200)', async () => {
    const ownProfileId = crypto.randomUUID();
    await db.insert(employeeProfiles).values({
      id: ownProfileId,
      tenantId,
      userId: lockedAdminId,
      employeeId: `EMP-C1A-${suffix}`,
      firstName: 'Locked',
      lastName: 'Admin',
      branchId: branchA,
    });
    asUser(lockedAdminId, `sess-c1-${suffix}-3`);
    try {
      const res = await employeeRoute.GET(new Request(`http://localhost/api/hr/employees/${ownProfileId}`), { params: Promise.resolve({ id: ownProfileId }) });
      expect(res.status).toBe(200);
    } finally {
      done();
      await db.delete(employeeProfiles).where(eq(employeeProfiles.id, ownProfileId));
    }
  });

  it('4. payments/online: a locked accountant cannot start a gateway session on another campus invoice (403)', async () => {
    asUser(lockedAcctId, `sess-c1-${suffix}-4`);
    try {
      const res = await paymentsOnlineRoute.POST(new Request('http://localhost/api/finance/payments/online', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoiceBId, paymentMethod: 'cmi' }),
      }));
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });

  it('5. report-card/issue: a locked admin cannot issue a bulletin for another campus student (403)', async () => {
    asUser(lockedAdminId, `sess-c1-${suffix}-5`);
    try {
      const res = await reportCardIssueRoute.POST(new Request('http://localhost/api/students/report-card/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: studentB }),
      }));
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });
});
