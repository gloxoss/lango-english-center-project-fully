import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { invoices, tenants, user } from '@/models/Schema';
import { GET } from '@/app/api/search/route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
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
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-search' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('search authorization per-role (D-12 / T1)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const adminId = `SEARCH-ADMIN-${suffix}`;
  const teacherId = `SEARCH-TEACHER-${suffix}`;
  const accountantId = `SEARCH-ACCOUNTANT-${suffix}`;
  const studentId = `SEARCH-STUDENT-${suffix}`;
  const guardId = `SEARCH-GUARD-${suffix}`;

  const targetStudentId = `TARGET-STU-${suffix}`;
  const targetTeacherId = `TARGET-TEA-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Search School ${suffix}`, slug: `search-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminId, tenantId: tenantA, name: 'Search Admin', email: `search-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: teacherId, tenantId: tenantA, name: 'Search Teacher', email: `search-teacher-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: accountantId, tenantId: tenantA, name: 'Search Accountant', email: `search-acct-${suffix}@test.local`, role: 'accountant', userStatus: 'active' },
      { id: studentId, tenantId: tenantA, name: 'Search Student User', email: `search-stu-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: guardId, tenantId: tenantA, name: 'Search Guard User', email: `search-guard-${suffix}@test.local`, role: 'guard', userStatus: 'active' },

      // Targets to be found in search:
      { id: targetStudentId, tenantId: tenantA, name: `TargetStudent ${suffix}`, email: `target-stu-${suffix}@test.local`, matricule: `MAT-STU-${suffix}`, role: 'student', userStatus: 'active' },
      { id: targetTeacherId, tenantId: tenantA, name: `TargetTeacher ${suffix}`, email: `target-tea-${suffix}@test.local`, matricule: `MAT-TEA-${suffix}`, role: 'teacher', userStatus: 'active' },
    ]);

    await db.insert(invoices).values([
      {
        id: crypto.randomUUID(),
        tenantId: tenantA,
        studentId: targetStudentId,
        invoiceNumber: `INV-TARGET-${suffix}`,
        amount: 5000,
        discountAmount: 0,
        netAmount: 5000,
        paidAmount: 0,
        status: 'pending',
        dueDate: '2026-09-01',
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(invoices).where(eq(invoices.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
  });

  it('school_admin can search students, teachers, and invoices', async () => {
    sessionUserId.value = adminId;
    const req = new Request(`http://localhost:3000/api/search?q=Target`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.students.length).toBeGreaterThanOrEqual(1);
    expect(json.data.teachers.length).toBeGreaterThanOrEqual(1);
    expect(json.data.invoices.length).toBeGreaterThanOrEqual(1);
  });

  it('teacher cannot see teachers or invoices (only students)', async () => {
    sessionUserId.value = teacherId;
    const req = new Request(`http://localhost:3000/api/search?q=Target`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.students.length).toBeGreaterThanOrEqual(1);
    // teachers & invoices MUST be empty for teacher role
    expect(json.data.teachers).toEqual([]);
    expect(json.data.invoices).toEqual([]);
  });

  it('accountant cannot see teachers (sees students and invoices)', async () => {
    sessionUserId.value = accountantId;
    const req = new Request(`http://localhost:3000/api/search?q=Target`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.students.length).toBeGreaterThanOrEqual(1);
    expect(json.data.invoices.length).toBeGreaterThanOrEqual(1);
    // teachers MUST be empty for accountant role
    expect(json.data.teachers).toEqual([]);
  });

  it('student role receives empty results for all categories', async () => {
    sessionUserId.value = studentId;
    const req = new Request(`http://localhost:3000/api/search?q=Target`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.students).toEqual([]);
    expect(json.data.teachers).toEqual([]);
    expect(json.data.invoices).toEqual([]);
  });

  it('guard role receives empty results for all categories', async () => {
    sessionUserId.value = guardId;
    const req = new Request(`http://localhost:3000/api/search?q=Target`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.students).toEqual([]);
    expect(json.data.teachers).toEqual([]);
    expect(json.data.invoices).toEqual([]);
  });
});
