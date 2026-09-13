import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/academics/exam-terms/[id]/marksheet/route';
import {
  assessmentAudiences,
  assessmentDefinitions,
  assessmentOutcomes,
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

// The marksheet roster GET that the keyboard grid loads.
//
// The load-bearing check is the teacher filter. The roster carries every
// student's name and national id, so an unscoped GET would hand any teacher
// holding grading.manage the whole school's roll — and assessment_audiences has
// no tenant_id column of its own, so the tenant boundary rests entirely on
// reaching it through a definition already proven to belong to the caller.

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
const ADMIN = `USR-MA-${crypto.randomUUID()}`;
const TEACHER_OWN = `USR-MT-${crypto.randomUUID()}`;
const STUDENT_MINE = `USR-MS-${crypto.randomUUID()}`;
const STUDENT_OTHER_SECTION = `USR-MX-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-MO-${crypto.randomUUID()}`;

const examTermId = crypto.randomUUID();
let definitionId = '';
let otherTenantDefinitionId = '';
let sectionMine = '';
let sectionNotMine = '';

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

function getRoster(defId: string): Promise<Response> {
  return GET(
    new Request(`http://localhost/api/academics/exam-terms/${examTermId}/marksheet?assessmentDefinitionId=${defId}`),
    { params: Promise.resolve({ id: examTermId }) },
  );
}

describe.skipIf(!dbReachable)('GET /api/academics/exam-terms/[id]/marksheet — roster', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Marksheet Test', slug: `ms-${tenantId}` },
      { id: otherTenantId, name: 'Marksheet Other', slug: `msx-${otherTenantId}` },
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
      { id: ADMIN, tenantId, name: 'Admin', email: `ma-${tenantId}@t.local`, role: 'school_admin' },
      { id: TEACHER_OWN, tenantId, name: 'Prof A', email: `mt-${tenantId}@t.local`, role: 'teacher' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `mo-${otherTenantId}@t.local`, role: 'school_admin' },
      { id: STUDENT_MINE, tenantId, name: 'Amine Alaoui', email: `ms-${tenantId}@t.local`, role: 'student', classSectionId: sectionMine, nationalId: 'BK12345' },
      { id: STUDENT_OTHER_SECTION, tenantId, name: 'Zineb Bennani', email: `mx-${tenantId}@t.local`, role: 'student', classSectionId: sectionNotMine },
    ]);

    // TEACHER_OWN teaches section A only.
    await db.insert(classTeachers).values({ tenantId, teacherId: TEACHER_OWN, classSectionId: sectionMine });

    const [definition] = await db.insert(assessmentDefinitions).values({
      tenantId,
      type: 'paper_exam',
      title: 'Contrôle 1 — Mathématiques',
      maximumScore: '40.00',
      passMark: '20.00',
      coefficient: '3.00',
      status: 'published',
    }).returning();
    definitionId = definition!.id;

    // Audience is written as two class-section ids — the shape the grid has to
    // resolve, and the one that decides which students appear.
    await db.insert(assessmentAudiences).values([
      { assessmentDefinitionId: definitionId, sectionId: sectionMine },
      { assessmentDefinitionId: definitionId, sectionId: sectionNotMine },
    ]);

    const [otherDefinition] = await db.insert(assessmentDefinitions).values({
      tenantId: otherTenantId,
      type: 'paper_exam',
      title: 'Autre établissement',
      maximumScore: '20.00',
      status: 'published',
    }).returning();
    otherTenantDefinitionId = otherDefinition!.id;
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentAudiences).where(eq(assessmentAudiences.assessmentDefinitionId, definitionId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, otherTenantId));
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

  it('returns the paper’s real scale, not an assumed /20', async () => {
    await asRole(ADMIN, 'school_admin');
    const res = await getRoster(definitionId);

    expect(res.status).toBe(200);

    const { data } = await res.json();

    expect(data.definition.maximumScore).toBe(40);
    expect(data.definition.passMark).toBe(20);
    expect(data.definition.coefficient).toBe(3);
  });

  it('resolves a section-shaped audience into its students', async () => {
    await asRole(ADMIN, 'school_admin');
    const { data } = await (await getRoster(definitionId)).json();

    expect(data.students.map((s: { studentId: string }) => s.studentId).sort())
      .toEqual([STUDENT_MINE, STUDENT_OTHER_SECTION].sort());
  });

  it('scopes a teacher to students in the sections they teach', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const { data } = await (await getRoster(definitionId)).json();

    const ids = data.students.map((s: { studentId: string }) => s.studentId);

    expect(ids).toEqual([STUDENT_MINE]);
    expect(ids).not.toContain(STUDENT_OTHER_SECTION);
  });

  it('does not leak a national id for a student outside a teacher’s sections', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const body = await (await getRoster(definitionId)).text();

    expect(body).not.toContain(STUDENT_OTHER_SECTION);
  });

  it('refuses a definition belonging to another tenant', async () => {
    await asRole(ADMIN, 'school_admin');

    expect((await getRoster(otherTenantDefinitionId)).status).toBe(404);
  });

  it('refuses this tenant’s definition when asked by the other tenant', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    expect((await getRoster(definitionId)).status).toBe(404);
  });

  it('requires the assessmentDefinitionId param', async () => {
    await asRole(ADMIN, 'school_admin');

    const res = await GET(
      new Request(`http://localhost/api/academics/exam-terms/${examTermId}/marksheet`),
      { params: Promise.resolve({ id: examTermId }) },
    );

    expect(res.status).toBe(400);
  });

  it('keeps a student visible once marked, even if the audience no longer lists them', async () => {
    // A mark you cannot see is a mark you cannot correct, so an outcome row
    // pulls its student back into the roster.
    await db.insert(assessmentOutcomes).values({
      tenantId,
      assessmentDefinitionId: definitionId,
      studentId: STUDENT_OTHER_SECTION,
      rawScore: '31.00',
      maximumScoreSnapshot: '40.00',
      status: 'graded',
    });

    await db.delete(assessmentAudiences)
      .where(eq(assessmentAudiences.sectionId, sectionNotMine));

    await asRole(ADMIN, 'school_admin');
    const { data } = await (await getRoster(definitionId)).json();

    expect(data.students.map((s: { studentId: string }) => s.studentId)).toContain(STUDENT_OTHER_SECTION);
    expect(data.existingMarks).toEqual([
      expect.objectContaining({ studentId: STUDENT_OTHER_SECTION, rawScore: 31, status: 'graded' }),
    ]);
  });
});
