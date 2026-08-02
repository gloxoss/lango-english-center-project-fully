import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mocked before importing anything that transitively pulls in @/libs/auth, so every
// route handler under test authenticates as whatever `currentSessionUserId` holds.
let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user } = await import('@/models/Schema');
const studentsRoute = await import('./students/route');
const usersRoute = await import('./users/route');
const auditLogsRoute = await import('./audit-logs/route');
const settingsLogoRoute = await import('./settings/logo/route');
const settingsAccessResetRoute = await import('./settings/access-reset/route');
const studentsDocumentsRoute = await import('./students/documents/route');
const teachersPhotoRoute = await import('./teachers/photo/route');
const financeReportsRoute = await import('./finance/reports/route');
const academicsClassResultsRoute = await import('./academics/class-results/route');
const academicsClassesRosterRoute = await import('./academics/classes/roster/route');
const academicsTimetableSlotsRoute = await import('./academics/timetable-slots/route');
const academicsTimetableConflictsRoute = await import('./academics/timetable-conflicts/route');
const academicsAssessmentSessionsRoute = await import('./academics/assessment-sessions/route');

// This suite requires a reachable Postgres with migrations applied - the same
// contract the app itself requires. It is not a mock DB: it is what makes these
// checks a regression test for the actual tenant-isolation and RBAC logic in
// src/libs/api/context.ts, rather than a test of the mock.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('API security regression suite', () => {
  const suffix = Date.now();
  // tenants.id is uuid; user.id is a plain text primary key, so only the tenant
  // ids need to be valid UUIDs.
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();
  const adminAId = `TEST-ADMIN-A-${suffix}`;
  const teacherAId = `TEST-TEACHER-A-${suffix}`;
  const disabledAdminId = `TEST-DISABLED-${suffix}`;
  const studentAId = `TEST-STU-A-${suffix}`;
  const adminBId = `TEST-ADMIN-B-${suffix}`;
  const studentBId = `TEST-STU-B-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantAId, name: 'Test Tenant A', slug: `test-a-${suffix}` },
      { id: tenantBId, name: 'Test Tenant B', slug: `test-b-${suffix}` },
    ]);

    await db.insert(user).values([
      { id: adminAId, tenantId: tenantAId, name: 'Admin A', email: `admin-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: teacherAId, tenantId: tenantAId, name: 'Teacher A', email: `teacher-a-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: disabledAdminId, tenantId: tenantAId, name: 'Disabled Admin', email: `disabled-${suffix}@test.local`, role: 'school_admin', userStatus: 'inactive' },
      { id: studentAId, tenantId: tenantAId, name: 'Student A', email: `stu-a-${suffix}@test.local`, role: 'student', matricule: `MAT-A-${suffix}` },
      { id: adminBId, tenantId: tenantBId, name: 'Admin B', email: `admin-b-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentBId, tenantId: tenantBId, name: 'Student B', email: `stu-b-${suffix}@test.local`, role: 'student', matricule: `MAT-B-${suffix}` },
    ]);
  });

  afterAll(async () => {
    // user rows first: tenants has no FK-cascade guarantee in the other direction.
    await db.delete(user).where(eq(user.tenantId, tenantAId));
    await db.delete(user).where(eq(user.tenantId, tenantBId));
    await db.delete(tenants).where(eq(tenants.id, tenantAId));
    await db.delete(tenants).where(eq(tenants.id, tenantBId));
  });

  it('rejects anonymous requests', async () => {
    currentSessionUserId = null;
    const res = await studentsRoute.GET(new Request('http://x/api/students'));

    expect(res.status).toBe(401);

    const body = await res.json();

    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects anonymous requests for all Sections 13-20 routes', async () => {
    currentSessionUserId = null;
    const routesToTest = [
      { name: 'audit-logs', handler: auditLogsRoute.GET, url: 'http://x/api/audit-logs' },
      { name: 'settings/logo', handler: settingsLogoRoute.GET, url: 'http://x/api/settings/logo' },
      { name: 'settings/access-reset', handler: settingsAccessResetRoute.GET, url: 'http://x/api/settings/access-reset' },
      { name: 'students/documents', handler: studentsDocumentsRoute.GET, url: 'http://x/api/students/documents?studentId=123' },
      { name: 'teachers/photo', handler: teachersPhotoRoute.GET, url: 'http://x/api/teachers/photo?teacherId=123' },
      { name: 'finance/reports', handler: financeReportsRoute.GET, url: 'http://x/api/finance/reports' },
      { name: 'academics/class-results', handler: academicsClassResultsRoute.GET, url: 'http://x/api/academics/class-results?classSubjectId=123' },
      { name: 'academics/classes/roster', handler: academicsClassesRosterRoute.GET, url: 'http://x/api/academics/classes/roster?id=123' },
      { name: 'academics/timetable-slots', handler: academicsTimetableSlotsRoute.GET, url: 'http://x/api/academics/timetable-slots' },
      { name: 'academics/timetable-conflicts', handler: academicsTimetableConflictsRoute.GET, url: 'http://x/api/academics/timetable-conflicts' },
      { name: 'academics/assessment-sessions', handler: academicsAssessmentSessionsRoute.GET, url: 'http://x/api/academics/assessment-sessions' },
    ];

    for (const r of routesToTest) {
      const res = await r.handler(new Request(r.url));
      expect(res.status, `Route ${r.name} should return 401 for anonymous`).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects a role outside the endpoint allowlist', async () => {
    // A teacher may READ students (attendance rosters need it - see the
    // allowlist on GET /api/students) but must never WRITE them. Asserting the
    // write side is what actually guards the privilege boundary.
    currentSessionUserId = teacherAId;

    const readRes = await studentsRoute.GET(new Request('http://x/api/students'));

    expect(readRes.status).toBe(200);

    const res = await studentsRoute.POST(new Request('http://x/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: 'X', lastName: 'Y', email: 'x@y.local' }),
    }));

    expect(res.status).toBe(403);

    const body = await res.json();

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a disabled account', async () => {
    currentSessionUserId = disabledAdminId;
    const res = await studentsRoute.GET(new Request('http://x/api/students'));

    expect(res.status).toBe(403);

    const body = await res.json();

    expect(body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('scopes students to the caller\'s tenant only', async () => {
    currentSessionUserId = adminAId;
    const res = await studentsRoute.GET(new Request('http://x/api/students'));

    expect(res.status).toBe(200);

    const body = await res.json();
    const ids = body.data.map((s: any) => s.id);

    expect(ids).toContain(studentAId);
    expect(ids).not.toContain(studentBId);
  });

  it('scopes users to the caller\'s tenant only', async () => {
    currentSessionUserId = adminBId;
    const res = await usersRoute.GET(new Request('http://x/api/users'));

    expect(res.status).toBe(200);

    const body = await res.json();
    const ids = body.data.map((u: any) => u.id);

    expect(ids).toContain(adminBId);
    expect(ids).not.toContain(adminAId);
  });

  it('rejects mutation payloads with unknown fields (mass-assignment guard)', async () => {
    currentSessionUserId = adminAId;
    const res = await studentsRoute.POST(new Request('http://x/api/students', {
      method: 'POST',
      body: JSON.stringify({ fullName: 'Hacker', schoolId: tenantBId }),
    }));

    expect(res.status).toBe(422);

    const body = await res.json();

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prevents an admin from deleting their own account', async () => {
    currentSessionUserId = adminAId;
    const res = await usersRoute.DELETE(new Request(`http://x/api/users?id=${adminAId}`, { method: 'DELETE' }));

    expect(res.status).toBe(409);

    const body = await res.json();

    expect(body.error.code).toBe('SELF_DELETE_FORBIDDEN');
  });

  it('does not allow deleting a record across tenants', async () => {
    currentSessionUserId = adminAId;
    const res = await usersRoute.DELETE(new Request(`http://x/api/users?id=${adminBId}`, { method: 'DELETE' }));

    expect(res.status).toBe(200);

    // The cross-tenant WHERE clause matched nothing, so the row must still exist.
    currentSessionUserId = adminBId;
    const check = await usersRoute.GET(new Request('http://x/api/users'));
    const body = await check.json();

    expect(body.data.map((u: any) => u.id)).toContain(adminBId);
  });
});
