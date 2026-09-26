import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Owner-directed regression test (bs-c6 close-out): the class-subjects COUNT
// query used to run joinless while the shared where-clause references
// subjects (search) and classes (branch scope) — any branch-limited caller
// or ?search= request answered 500 (missing FROM-clause entry). Both queries
// now carry the same joins; these cases pin that.

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
const { branches, classSections, classes, classSubjects, mediums, sections, subjects, tenants, user } = await import('@/models/Schema');
const classSubjectsRoute = await import('@/app/api/academics/class-subjects/route');
const { subjectTeachers } = await import('@/models/Schema');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('class-subjects count join — branch-limited teacher + search', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);
  const branchA = crypto.randomUUID();
  const branchB = crypto.randomUUID();
  const classBId = crypto.randomUUID();
  const sectionBId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const classSubjectId = crypto.randomUUID();
  const teacherId = `USR-CS-TCH-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'CS Join Test', slug: `cs-${suffix}` });
    await db.insert(branches).values([
      { id: branchA, tenantId, name: 'Siege', code: `CSA-${suffix}` },
      { id: branchB, tenantId, name: 'Maarif', code: `CSB-${suffix}` },
    ]);
    await db.insert(mediums).values({ id: mediumId, tenantId, name: `Français CS ${suffix}` });
    await db.insert(classes).values({ id: classBId, tenantId, name: `3ème CS ${suffix}`, branchId: branchB, mediumId });
    await db.insert(sections).values({ id: sectionBId, tenantId, name: `A CS ${suffix}` });
    const [classSectionRow] = await db
      .insert(classSections)
      .values({ tenantId, classId: classBId, sectionId: sectionBId, mediumId })
      .returning({ id: classSections.id });
    await db.insert(subjects).values({ id: subjectId, tenantId, name: `Mathematiques CS ${suffix}`, mediumId, type: 'theory' });
    await db.insert(user).values([
      {
        id: teacherId,
        tenantId,
        name: 'Prof Cross CS',
        email: `cs-tch-${suffix}@t.local`,
        role: 'teacher',
        userStatus: 'active',
        branchId: branchA, // teacher HOME campus is A...
      },
    ]);
    // The class-subject row the assignment points at.
    await db.insert(classSubjects).values({
      id: classSubjectId,
      tenantId,
      classId: classBId,
      subjectId,
      type: 'compulsory',
      isActive: true,
    });
    // ...and they are ASSIGNED to the campus-B class subject (the owner's
    // teacher rule: assignments win). The route narrows by assignment pairs.
    await db.insert(subjectTeachers).values({
      tenantId,
      teacherId,
      classSectionId: classSectionRow!.id,
      classSubjectId,
      subjectId,
      status: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
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

  it('1. a branch-limited teacher assigned to a cross-campus section gets 200 (not 500)', async () => {
    asUser(teacherId, `sess-cs-${suffix}-1`);
    try {
      const res = await classSubjectsRoute.GET(new Request('http://localhost/api/academics/class-subjects'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Their one assignment, and the total must agree with the joined list.
      expect(json.total).toBe(1);
      expect(json.data).toHaveLength(1);
    } finally {
      done();
    }
  });

  it('2. ?search= answers 200 and keeps total consistent with the list', async () => {
    asUser(teacherId, `sess-cs-${suffix}-2`);
    try {
      const res = await classSubjectsRoute.GET(new Request('http://localhost/api/academics/class-subjects?search=Mathematiques'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.total).toBe(1);
      expect(json.data[0]?.subjectName).toContain('Mathematiques CS');
    } finally {
      done();
    }
  });

  it('3. ?search= with no match answers 200 with an empty list and total 0', async () => {
    asUser(teacherId, `sess-cs-${suffix}-3`);
    try {
      const res = await classSubjectsRoute.GET(new Request('http://localhost/api/academics/class-subjects?search=ZZZNOMATCH'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(0);
      expect(json.data).toHaveLength(0);
    } finally {
      done();
    }
  });
});
