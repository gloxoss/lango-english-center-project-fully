import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as saveMarksheet } from '@/app/api/academics/exam-terms/[id]/marksheet/route';
import { GET, POST } from '@/app/api/academics/grade-entry/route';
import {
  assessmentAudiences,
  assessmentDefinitions,
  assessmentOutcomes,
  examTerms,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import {
  classes,
  classSections,
  classTeachers,
  mediums,
  sections,
  tenants,
  user,
} from '@/models/Schema';

// The standalone grade-entry endpoint, and the write-scope hole it closed.
//
// The page this backs used to render a hardcoded student exam-taking mock — ten
// invented maths questions with pre-filled answers — so there was no grade-entry
// endpoint at all. The exam-term marksheet POST that did exist scoped its GET to
// a teacher's own sections but not its POST, so any teacher holding
// grading.manage could record a mark for any student in the school. Marks reach
// families, so that is the same shape of bug as D-16.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const otherTenantId = crypto.randomUUID();
const ADMIN = `USR-GA-${crypto.randomUUID()}`;
const TEACHER_OWN = `USR-GT-${crypto.randomUUID()}`;
const STUDENT_MINE = `USR-GM-${crypto.randomUUID()}`;
const STUDENT_NOT_MINE = `USR-GN-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-GO-${crypto.randomUUID()}`;

let definitionId = '';
let otherDefinitionId = '';
let examTermId = '';
let sectionMine = '';
let sectionNotMine = '';

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

function getRoster(defId = definitionId): Promise<Response> {
  return GET(new Request(`http://localhost/api/academics/grade-entry?assessmentDefinitionId=${defId}`));
}

function postMarks(marks: unknown[], defId = definitionId): Promise<Response> {
  return POST(new Request('http://localhost/api/academics/grade-entry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assessmentDefinitionId: defId, marks }),
  }));
}

describe.skipIf(!dbReachable)('/api/academics/grade-entry — roster and write scope', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Grade Entry Test', slug: `ge-${tenantId}` },
      { id: otherTenantId, name: 'Grade Entry Other', slug: `gex-${otherTenantId}` },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: 'FR' }).returning();
    const [klass] = await db.insert(classes).values({ tenantId, name: '2BAC', mediumId: medium!.id }).returning();
    const secRows = await db.insert(sections).values([
      { tenantId, name: 'A' },
      { tenantId, name: 'B' },
    ]).returning();

    const csRows = await db.insert(classSections).values([
      { tenantId, classId: klass!.id, sectionId: secRows[0]!.id, mediumId: medium!.id },
      { tenantId, classId: klass!.id, sectionId: secRows[1]!.id, mediumId: medium!.id },
    ]).returning();
    sectionMine = csRows[0]!.id;
    sectionNotMine = csRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, name: 'Admin', email: `ga-${tenantId}@t.local`, role: 'school_admin' },
      { id: TEACHER_OWN, tenantId, name: 'Prof A', email: `gt-${tenantId}@t.local`, role: 'teacher' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `go-${otherTenantId}@t.local`, role: 'school_admin' },
      { id: STUDENT_MINE, tenantId, name: 'Amine', email: `gm-${tenantId}@t.local`, role: 'student', classSectionId: sectionMine },
      { id: STUDENT_NOT_MINE, tenantId, name: 'Zineb', email: `gn-${tenantId}@t.local`, role: 'student', classSectionId: sectionNotMine },
    ]);

    await db.insert(classTeachers).values({ tenantId, teacherId: TEACHER_OWN, classSectionId: sectionMine });

    const [definition] = await db.insert(assessmentDefinitions).values({
      tenantId,
      type: 'quiz',
      title: 'Contrôle continu 1',
      maximumScore: '20.00',
      passMark: '10.00',
      status: 'published',
    }).returning();
    definitionId = definition!.id;

    await db.insert(assessmentAudiences).values([
      { assessmentDefinitionId: definitionId, sectionId: sectionMine },
      { assessmentDefinitionId: definitionId, sectionId: sectionNotMine },
    ]);

    const [otherDefinition] = await db.insert(assessmentDefinitions).values({
      tenantId: otherTenantId,
      type: 'quiz',
      title: 'Autre établissement',
      maximumScore: '20.00',
      status: 'published',
    }).returning();
    otherDefinitionId = otherDefinition!.id;

    // A term parked in `valuation`, so the marksheet POST's stage gate is open and
    // the scope check below is what is actually being measured.
    const [term] = await db.insert(examTerms).values({
      tenantId,
      name: 'Session',
      code: 'S',
      startDate: '2026-06-01',
      endDate: '2026-06-20',
      status: 'valuation',
    }).returning();
    examTermId = term!.id;
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentAudiences).where(eq(assessmentAudiences.assessmentDefinitionId, definitionId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, otherTenantId));
    await db.delete(examTerms).where(eq(examTerms.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('returns the paper’s scale and its whole roster to an admin', async () => {
    await asRole(ADMIN, 'school_admin');
    const res = await getRoster();

    expect(res.status).toBe(200);

    const { data } = await res.json();

    expect(data.definition.maximumScore).toBe(20);
    expect(data.students.map((s: { studentId: string }) => s.studentId).sort())
      .toEqual([STUDENT_MINE, STUDENT_NOT_MINE].sort());
  });

  it('shows a teacher only students in the sections they teach', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const { data } = await (await getRoster()).json();

    expect(data.students.map((s: { studentId: string }) => s.studentId)).toEqual([STUDENT_MINE]);
  });

  it('lets a teacher save a mark for their own student', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postMarks([{ studentId: STUDENT_MINE, rawScore: 14, status: 'graded' }]);

    expect(res.status).toBe(200);

    const rows = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.studentId, STUDENT_MINE));

    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.rawScore)).toBe(14);
  });

  it('refuses a teacher marking a student outside their sections', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postMarks([{ studentId: STUDENT_NOT_MINE, rawScore: 18, status: 'graded' }]);

    expect(res.status).toBe(403);

    const rows = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.studentId, STUDENT_NOT_MINE));

    expect(rows).toHaveLength(0);
  });

  it('refuses the whole batch when any student is out of scope', async () => {
    // Partial acceptance would leave a teacher believing they saved marks they
    // had not, and those marks reach families.
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postMarks([
      { studentId: STUDENT_MINE, rawScore: 11, status: 'graded' },
      { studentId: STUDENT_NOT_MINE, rawScore: 11, status: 'graded' },
    ]);

    expect(res.status).toBe(403);

    const rows = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.studentId, STUDENT_MINE));

    expect(Number(rows[0]!.rawScore)).toBe(14); // unchanged from the earlier save
  });

  it('still lets an admin mark any student in the school', async () => {
    await asRole(ADMIN, 'school_admin');

    expect((await postMarks([{ studentId: STUDENT_NOT_MINE, rawScore: 16, status: 'graded' }])).status).toBe(200);
  });

  it('refuses a score above the paper’s maximum', async () => {
    await asRole(ADMIN, 'school_admin');

    // 155 for 15.5 is the classic fat-finger, and it silently skews every average.
    const res = await postMarks([{ studentId: STUDENT_MINE, rawScore: 155, status: 'graded' }]);

    expect(res.status).toBe(422);
  });

  it('refuses a definition belonging to another tenant', async () => {
    await asRole(ADMIN, 'school_admin');

    expect((await getRoster(otherDefinitionId)).status).toBe(404);
    expect((await postMarks([{ studentId: STUDENT_MINE, rawScore: 10 }], otherDefinitionId)).status).toBe(404);
  });

  it('refuses this tenant’s definition when asked by the other tenant', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    expect((await getRoster()).status).toBe(404);
  });

  it('requires the assessmentDefinitionId param on read', async () => {
    await asRole(ADMIN, 'school_admin');

    expect((await GET(new Request('http://localhost/api/academics/grade-entry'))).status).toBe(400);
  });

  it('closes the same write-scope hole on the exam-term marksheet POST', async () => {
    // The GET there was scoped; the POST was not.
    await asRole(TEACHER_OWN, 'teacher');

    const res = await saveMarksheet(
      new Request(`http://localhost/api/academics/exam-terms/${examTermId}/marksheet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assessmentDefinitionId: definitionId,
          marks: [{ studentId: STUDENT_NOT_MINE, rawScore: 19, status: 'graded' }],
        }),
      }),
      { params: Promise.resolve({ id: examTermId }) },
    );

    expect(res.status).toBe(403);
  });
});
