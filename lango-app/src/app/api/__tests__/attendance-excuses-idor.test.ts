// D-13: a parent could read/create attendance excuses for ANY studentId in
// the tenant - GET had no scoping branch for 'parent' at all (falling into
// the generic `else if (studentIdParam)` with no ownership check, and no
// studentIdParam meant no filter at all - every family's excuses, tenant-
// wide); POST trusted body.studentId unconditionally for non-student roles.
// Found during independent verification of Wave 1 (2026-08-27), not part of
// the original D-5/D-12 findings.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendanceExcuses, guardianStudents, guardians, tenants, user } from '@/models/Schema';
import { GET, POST } from '@/app/api/attendance/excuses/route';

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
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-excuses-idor' } }
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

describe.skipIf(!dbReachable)('D-13: attendance excuses IDOR (parent scoping)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const guardianRowId = crypto.randomUUID();

  const parentUserId = `EXC-PARENT-${suffix}`;
  const ownChildId = `EXC-OWNCHILD-${suffix}`;
  const strangerChildId = `EXC-STRANGER-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([{ id: tenantId, name: `Excuse School ${suffix}`, slug: `excuse-${suffix}` }]);
    await db.insert(user).values([
      { id: parentUserId, tenantId, name: 'Excuse Parent', email: `exc-parent-${suffix}@test.local`, role: 'parent', userStatus: 'active' },
      { id: ownChildId, tenantId, name: 'Own Child', email: `exc-own-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: strangerChildId, tenantId, name: 'Stranger Child', email: `exc-stranger-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);
    await db.insert(guardians).values([
      { id: guardianRowId, tenantId, userId: parentUserId, firstName: 'Excuse', lastName: 'Parent' },
    ]);
    await db.insert(guardianStudents).values([
      { tenantId, guardianId: guardianRowId, studentId: ownChildId, relationshipType: 'parent' },
    ]);
    await db.insert(attendanceExcuses).values([
      { tenantId, studentId: ownChildId, date: '2026-09-01', reason: 'Own child reason', status: 'pending' },
      { tenantId, studentId: strangerChildId, date: '2026-09-01', reason: 'STRANGER FAMILY MEDICAL DETAIL', status: 'pending' },
    ]);
  });

  afterAll(async () => {
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('GET with no studentId returns only the parent\'s own children, never the whole tenant', async () => {
    sessionUserId.value = parentUserId;
    const req = new Request('http://localhost:3000/api/attendance/excuses');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    const studentIds = json.data.map((r: { studentId: string }) => r.studentId);
    expect(studentIds).toContain(ownChildId);
    expect(studentIds).not.toContain(strangerChildId);
  });

  it('GET with a stranger\'s studentId is denied, not honoured', async () => {
    sessionUserId.value = parentUserId;
    const req = new Request(`http://localhost:3000/api/attendance/excuses?studentId=${strangerChildId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('POST cannot create an excuse for a student who is not the parent\'s child', async () => {
    sessionUserId.value = parentUserId;
    const req = new Request('http://localhost:3000/api/attendance/excuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: strangerChildId, date: '2026-09-02', reason: 'Forged excuse attempt' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('POST succeeds for the parent\'s own child', async () => {
    sessionUserId.value = parentUserId;
    const req = new Request('http://localhost:3000/api/attendance/excuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: ownChildId, date: '2026-09-03', reason: 'Legitimate excuse' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
