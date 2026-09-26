import type { RequestContext } from '@/libs/api/context';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as listEvaluations } from '@/app/api/academics/assessment-sessions/route';
import { DELETE as deleteClassSubject } from '@/app/api/academics/class-subjects/route';
import { DELETE as deleteClass } from '@/app/api/academics/classes/route';
import { POST as createDefinition } from '@/app/api/academics/assessment-definitions/route';
import { resolveMarksheetRoster } from '@/features/assessment/services/marksheet-roster';
import { assessmentAudiences, assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { requireRequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { classes, classSections, classSubjects, mediums, sections, subjects, subjectTeachers, tenants, user } from '@/models/Schema';

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

// GRADES-CANONICAL-01 follow-up: the Evaluations list must show real graded
// counts from assessment_outcomes, and a subject or class carrying real
// assessments must not be deletable (assessment_definitions has no FK).
describe('grades integrity (schoolos_audit)', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const classSubjectId = crypto.randomUUID();
  const quizId = crypto.randomUUID();
  const homeworkId = crypto.randomUUID();
  const otherDefId = crypto.randomUUID();

  const asAdmin = (tid: string) => vi.mocked(requireRequestContext).mockResolvedValue({
    userId: 'adm', tenantId: tid, role: 'school_admin', baseRole: 'school_admin', branchId: null, branchLocked: false,
  } as unknown as RequestContext);

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Grades Integrity', slug: `gi-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Grades Integrity Other', slug: `gio-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Medium' });
    await db.insert(classes).values({ id: classId, tenantId, name: '3ème', mediumId });
    await db.insert(subjects).values({ id: subjectId, tenantId, name: 'Mathématiques', mediumId, type: 'theory' });
    await db.insert(classSubjects).values({ id: classSubjectId, tenantId, classId, subjectId, type: 'compulsory' });
    await db.insert(assessmentDefinitions).values([
      { id: quizId, tenantId, classSubjectId, title: 'Contrôle 1', type: 'quiz' },
      { id: homeworkId, tenantId, classSubjectId, title: 'Devoir maison', type: 'homework' },
      { id: otherDefId, tenantId: otherTenantId, title: 'Autre école', type: 'quiz' },
    ]);
    await db.insert(assessmentOutcomes).values([
      { tenantId, assessmentDefinitionId: quizId, studentId: 's1', status: 'graded', moderationState: 'published', rawScore: '14' },
      { tenantId, assessmentDefinitionId: quizId, studentId: 's2', status: 'graded', moderationState: 'draft', rawScore: '9' },
      { tenantId, assessmentDefinitionId: quizId, studentId: 's3', status: 'pending', moderationState: 'draft' },
    ]);
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(inArray(assessmentOutcomes.tenantId, [tenantId, otherTenantId]));
    await db.delete(assessmentDefinitions).where(inArray(assessmentDefinitions.tenantId, [tenantId, otherTenantId]));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('lists canonical assessments with real graded and published counts, homework excluded, tenant-scoped', async () => {
    asAdmin(tenantId);
    const res = await listEvaluations(new Request('http://x/api/academics/assessment-sessions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.map((r: { id: string }) => r.id)).toEqual([quizId]);
    expect(body.data[0]).toMatchObject({ title: 'Contrôle 1', type: 'quiz', className: '3ème', subjectName: 'Mathématiques', gradedCount: 2, publishedCount: 1 });
  });

  it('refuses to delete a class subject that carries real assessments', async () => {
    asAdmin(tenantId);
    const res = await deleteClassSubject(new Request(`http://x/api/academics/class-subjects?id=${classSubjectId}`, { method: 'DELETE' }));

    expect(res.status).toBe(409);
    const [still] = await db.select().from(classSubjects).where(eq(classSubjects.id, classSubjectId));

    expect(still).toBeDefined();
  });

  it('lists canonical assessments as a blocker when deleting the class', async () => {
    asAdmin(tenantId);
    const res = await deleteClass(new Request(`http://x/api/academics/classes?id=${classId}`, { method: 'DELETE' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'assessments', count: 2 })]));
  });
});

// An épreuve created through the app must carry its class subject and an
// audience, otherwise its marksheet roster is empty and nobody can grade it.
describe('creating an épreuve with a class subject (schoolos_audit)', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const classSubjectId = crypto.randomUUID();
  const sectionA = crypto.randomUUID();
  const sectionB = crypto.randomUUID();
  const csA = crypto.randomUUID();
  const csB = crypto.randomUUID();
  const otherMedium = crypto.randomUUID();
  const otherClass = crypto.randomUUID();
  const otherSubject = crypto.randomUUID();
  const otherClassSubject = crypto.randomUUID();
  const TEACHER = `tch-${crypto.randomUUID()}`;
  const STUDENT_A = `stu-a-${crypto.randomUUID()}`;
  const STUDENT_B = `stu-b-${crypto.randomUUID()}`;

  const as = (role: 'school_admin' | 'teacher', userId: string) => vi.mocked(requireRequestContext).mockResolvedValue({
    userId, tenantId, role, baseRole: role, branchId: null, branchLocked: false,
  } as unknown as RequestContext);
  const create = (body: Record<string, unknown>) => createDefinition(new Request('http://x/api/academics/assessment-definitions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Epreuve Create', slug: `ec-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Epreuve Create Other', slug: `eco-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(mediums).values([{ id: mediumId, tenantId, name: 'M' }, { id: otherMedium, tenantId: otherTenantId, name: 'M' }]);
    await db.insert(classes).values([{ id: classId, tenantId, name: '2nde', mediumId }, { id: otherClass, tenantId: otherTenantId, name: '2nde', mediumId: otherMedium }]);
    await db.insert(subjects).values([{ id: subjectId, tenantId, name: 'Physique', mediumId, type: 'theory' }, { id: otherSubject, tenantId: otherTenantId, name: 'Physique', mediumId: otherMedium, type: 'theory' }]);
    await db.insert(classSubjects).values([{ id: classSubjectId, tenantId, classId, subjectId, type: 'compulsory' }, { id: otherClassSubject, tenantId: otherTenantId, classId: otherClass, subjectId: otherSubject, type: 'compulsory' }]);
    await db.insert(sections).values([{ id: sectionA, tenantId, name: 'A' }, { id: sectionB, tenantId, name: 'B' }]);
    await db.insert(classSections).values([
      { id: csA, tenantId, classId, sectionId: sectionA, mediumId },
      { id: csB, tenantId, classId, sectionId: sectionB, mediumId },
    ]);
    await db.insert(user).values([
      { id: TEACHER, tenantId, email: `${TEACHER}@x.ma`, name: 'Prof', role: 'teacher' },
      { id: STUDENT_A, tenantId, email: `${STUDENT_A}@x.ma`, name: 'Eleve A', role: 'student', classSectionId: csA },
      { id: STUDENT_B, tenantId, email: `${STUDENT_B}@x.ma`, name: 'Eleve B', role: 'student', classSectionId: csB },
    ]);
    await db.insert(subjectTeachers).values({ tenantId, classSectionId: csA, subjectId, classSubjectId, teacherId: TEACHER, status: 'active' });
  });

  afterAll(async () => {
    const defs = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    if (defs.length > 0) {
      await db.delete(assessmentAudiences).where(inArray(assessmentAudiences.assessmentDefinitionId, defs.map(d => d.id)));
    }
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(classSubjects).where(inArray(classSubjects.tenantId, [tenantId, otherTenantId]));
    await db.delete(subjects).where(inArray(subjects.tenantId, [tenantId, otherTenantId]));
    await db.delete(classes).where(inArray(classes.tenantId, [tenantId, otherTenantId]));
    await db.delete(mediums).where(inArray(mediums.tenantId, [tenantId, otherTenantId]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('admin: links the subject and targets every section of the class; the roster is not empty', async () => {
    as('school_admin', 'adm');
    const res = await create({ title: 'DS Physique', type: 'paper_exam', classSubjectId });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.classSubjectId).toBe(classSubjectId);

    const roster = await resolveMarksheetRoster(tenantId, body.data.id);

    expect(roster?.students.map(s => s.studentId).sort()).toEqual([STUDENT_A, STUDENT_B].sort());
  });

  it('teacher: only the sections where they teach the subject', async () => {
    as('teacher', TEACHER);
    const res = await create({ title: 'Contrôle A', type: 'quiz', classSubjectId });
    const body = await res.json();

    expect(res.status).toBe(201);

    const roster = await resolveMarksheetRoster(tenantId, body.data.id);

    expect(roster?.students.map(s => s.studentId)).toEqual([STUDENT_A]);
    expect((await create({ title: 'Contrôle B', type: 'quiz', classSubjectId, classSectionIds: [csB] })).status).toBe(403);
  });

  it('refuses a class subject of another school, and sections without a subject', async () => {
    as('school_admin', 'adm');

    expect((await create({ title: 'X', classSubjectId: otherClassSubject })).status).toBe(422);
    expect((await create({ title: 'Y', classSectionIds: [csA] })).status).toBe(422);
  });
});
