import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// BRANCH-SCOPE-01 c2 tests — write-guard proof for the modules whose locked
// writes were not yet pinned by a test: attendance (mark another campus's
// section) and teachers (create into another campus).

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
const { addonEntitlements, branches, classes, classSections, mediums, sections, sessionYears, tenants, user } = await import('@/models/Schema');
const attendanceRoute = await import('@/app/api/attendance/route');
const cardsIssueRoute = await import('@/app/api/cards/issue/route');
const teachersRoute = await import('@/app/api/teachers/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('c2 branch scope — locked users cannot write into another campus', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();
  const classBId = crypto.randomUUID();
  const sectionBId = crypto.randomUUID();
  const mediumBId = crypto.randomUUID();

  const lockedAdminId = `USR-C2-LADM-${suffix}`; // school_admin hard-locked to A

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'C2 Write Test', slug: `c2-${suffix}` });
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `C2A-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `C2B-${suffix}` },
    ]);
    await db.insert(user).values({
      id: lockedAdminId,
      tenantId,
      name: 'Locked Admin',
      email: `c2-ladm-${suffix}@t.local`,
      role: 'school_admin',
      userStatus: 'active',
      branchId: branchA,
    });
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'card-management', isEnabled: true });
    await db.insert(user).values({
      id: `USR-C2-STU-B-${suffix}`,
      tenantId,
      name: 'Student B',
      email: `c2-stu-b-${suffix}@t.local`,
      role: 'student',
      userStatus: 'active',
      branchId: branchB,
    });
    // Attendance needs the tenant to have an academic session, and campus B
    // needs a markable class section.
    await db.insert(sessionYears).values({
      tenantId,
      name: `2026-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    });
    await db.insert(mediums).values({ id: mediumBId, tenantId, name: `Français C2 ${suffix}` });
    await db.insert(classes).values({ id: classBId, tenantId, name: `Classe B C2 ${suffix}`, branchId: branchB, mediumId: mediumBId });
    await db.insert(sections).values({ id: sectionBId, tenantId, name: `Section B C2 ${suffix}` });
    await db.insert(classSections).values({
      tenantId,
      classId: classBId,
      sectionId: sectionBId,
      mediumId: mediumBId,
    });
  });

  afterAll(async () => {
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
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

  it('1. attendance: a locked admin cannot mark another campus section (403)', async () => {
    const [cs] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(eq(classSections.tenantId, tenantId))
      .limit(1);
    expect(cs).toBeTruthy();
    asUser(lockedAdminId, `sess-c2-${suffix}-1`);
    try {
      const res = await attendanceRoute.POST(new Request('http://localhost/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date: '2026-09-25',
          studentGroupId: cs!.id,
          records: [{ studentId: `USR-C2-NOPE-${suffix}`, status: 'present' }],
        }),
      }));
      // The campus lock fires before any student-id validation.
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json?.error?.code ?? json?.code).toBe('FORBIDDEN');
    } finally {
      done();
    }
  });

  it('2. teachers: a locked admin cannot create a teacher on another campus (403)', async () => {
    asUser(lockedAdminId, `sess-c2-${suffix}-2`);
    try {
      const res = await teachersRoute.POST(new Request('http://localhost/api/teachers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: `Prof Cross C2 ${suffix}`, branchId: branchB }),
      }));
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });

  it('3. teachers: the locked admin CAN create on their own campus', async () => {
    asUser(lockedAdminId, `sess-c2-${suffix}-3`);
    try {
      const res = await teachersRoute.POST(new Request('http://localhost/api/teachers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: `Prof Own C2 ${suffix}` }),
      }));
      expect([200, 201]).toContain(res.status);
    } finally {
      done();
    }
  });

  it('4. cards: a locked admin cannot issue a card for another campus student (403)', async () => {
    asUser(lockedAdminId, `sess-c2-${suffix}-4`);
    try {
      const res = await cardsIssueRoute.POST(new Request('http://localhost/api/cards/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: crypto.randomUUID(),
          subjectType: 'student',
          subjectId: `USR-C2-STU-B-${suffix}`,
        }),
      }));
      // The campus lock fires before any template resolution.
      expect(res.status).toBe(403);
    } finally {
      done();
    }
  });
});
