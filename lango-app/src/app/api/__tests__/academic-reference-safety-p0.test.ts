import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteMedium } from '@/app/api/academics/mediums/route';
import { DELETE as deleteSemester } from '@/app/api/academics/semesters/route';
import { DELETE as deleteShift } from '@/app/api/academics/shifts/route';
import { DELETE as deleteSubject } from '@/app/api/academics/subjects/route';
import { db } from '@/libs/DB';
import {
  classes,
  classSections,
  classSubjects,
  mediums,
  sections,
  semesters,
  shifts,
  subjects,
  subjectTeachers,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed proof for reference safety of the academic catalogue:
//   GROUP 10 medium delete safety (teaching language, never a locale)
//   GROUP 11 period/semester delete safety (current exposed CRUD only)
//   GROUP 12 shift delete safety (actual dependency graph = classes.shiftId)
//   GROUP 13 subject delete safety (curriculum/assignment/attendance refs)

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
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const otherTenantId = crypto.randomUUID();
const ADMIN = `USR-REF-${suffix}`;

let mediumUsed = '';
let mediumUnused = '';
let mediumT2 = '';
let shiftUsed = '';
let shiftUnused = '';
let shiftT2 = '';
let semesterUsed = '';
let semesterUnused = '';
let semesterT2 = '';
let subjectUsed = '';
let subjectUnused = '';
let subjectT2 = '';
let classSubjectId = '';
let subjectTeacherId = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId: ADMIN, tenantId, role: 'school_admin', branchId: null } as RequestContext);
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

describe.skipIf(!dbReachable)('academic reference safety P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `P0 Ref ${suffix}`, slug: `p0-ref-${suffix}` },
      { id: otherTenantId, name: `P0 Ref X ${suffix}`, slug: `p0-refx-${suffix}` },
    ]);

    const mediumRows = await db.insert(mediums).values([
      { tenantId, name: `Used-${suffix}` },
      { tenantId, name: `Unused-${suffix}` },
      { tenantId: otherTenantId, name: `T2-${suffix}` },
    ]).returning();
    mediumUsed = mediumRows[0]!.id;
    mediumUnused = mediumRows[1]!.id;
    mediumT2 = mediumRows[2]!.id;

    const shiftRows = await db.insert(shifts).values([
      { tenantId, name: `Morning-${suffix}`, startTime: '08:00', endTime: '12:00' },
      { tenantId, name: `Unused-${suffix}`, startTime: '14:00', endTime: '18:00' },
      { tenantId: otherTenantId, name: `T2-${suffix}`, startTime: '08:00', endTime: '12:00' },
    ]).returning();
    shiftUsed = shiftRows[0]!.id;
    shiftUnused = shiftRows[1]!.id;
    shiftT2 = shiftRows[2]!.id;

    const semesterRows = await db.insert(semesters).values([
      { tenantId, name: `S1-${suffix}`, startMonth: 9, endMonth: 12 },
      { tenantId, name: `Unused-${suffix}`, startMonth: 1, endMonth: 3 },
      { tenantId: otherTenantId, name: `T2-${suffix}`, startMonth: 9, endMonth: 12 },
    ]).returning();
    semesterUsed = semesterRows[0]!.id;
    semesterUnused = semesterRows[1]!.id;
    semesterT2 = semesterRows[2]!.id;

    const subjectRows = await db.insert(subjects).values([
      { tenantId, name: `Maths-${suffix}`, mediumId: mediumUsed, type: 'theory' },
      { tenantId, name: `Unused-${suffix}`, mediumId: mediumUsed, type: 'theory' },
      { tenantId: otherTenantId, name: `T2-${suffix}`, mediumId: mediumT2, type: 'theory' },
    ]).returning();
    subjectUsed = subjectRows[0]!.id;
    subjectUnused = subjectRows[1]!.id;
    subjectT2 = subjectRows[2]!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: null, name: 'Admin', email: `ref-${suffix}@t.local`, role: 'school_admin' },
      { id: `USR-REF-T-${suffix}`, tenantId, branchId: null, name: 'Teacher', email: `reft-${suffix}@t.local`, role: 'teacher' },
    ]);

    const [cls] = await db.insert(classes).values({
      tenantId,
      branchId: null,
      name: `2nde-${suffix}`,
      mediumId: mediumUsed,
      shiftId: shiftUsed,
    }).returning();

    const [label] = await db.insert(sections).values({ tenantId, name: `A-${suffix}` }).returning();
    const [classSection] = await db.insert(classSections).values({
      tenantId,
      classId: cls!.id,
      sectionId: label!.id,
      mediumId: mediumUsed,
      maxStudents: 30,
    }).returning();

    const [classSubject] = await db.insert(classSubjects).values({
      tenantId,
      classId: cls!.id,
      subjectId: subjectUsed,
      type: 'compulsory',
      semesterId: semesterUsed,
      coefficient: '3.50',
      weeklyMinutes: 180,
      displayOrder: 2,
      curriculumLabel: `Cadre-${suffix}`,
      isActive: true,
    }).returning();
    classSubjectId = classSubject!.id;

    const [subjectTeacher] = await db.insert(subjectTeachers).values({
      tenantId,
      classSectionId: classSection!.id,
      subjectId: subjectUsed,
      classSubjectId: classSubject!.id,
      teacherId: `USR-REF-T-${suffix}`,
      startsOn: '2026-09-01',
      status: 'active',
    }).returning();
    subjectTeacherId = subjectTeacher!.id;
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, otherTenantId));
    await db.delete(semesters).where(eq(semesters.tenantId, tenantId));
    await db.delete(semesters).where(eq(semesters.tenantId, otherTenantId));
    await db.delete(shifts).where(eq(shifts.tenantId, tenantId));
    await db.delete(shifts).where(eq(shifts.tenantId, otherTenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, otherTenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  describe('group 10 — medium delete / reference safety', () => {
    it('blocks deleting a medium referenced by classes, sections and subjects', async () => {
      const res = await deleteMedium(new Request(`http://x/api/academics/mediums?id=${mediumUsed}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('MEDIUM_IN_USE');

      const keys = body.blockers.map((b: { key: string }) => b.key);

      expect(keys).toContain('classes');
      expect(keys).toContain('class_sections');
      expect(keys).toContain('subjects');

      const rows = await db.select({ id: mediums.id }).from(mediums).where(eq(mediums.id, mediumUsed));

      expect(rows).toHaveLength(1);
    });

    it('deletes an unused medium following the normal lifecycle', async () => {
      const res = await deleteMedium(new Request(`http://x/api/academics/mediums?id=${mediumUnused}`));

      expect(res.status).toBe(200);

      const rows = await db.select({ id: mediums.id }).from(mediums).where(eq(mediums.id, mediumUnused));

      expect(rows).toHaveLength(0);
    });

    it('rejects a cross-tenant medium id', async () => {
      const res = await deleteMedium(new Request(`http://x/api/academics/mediums?id=${mediumT2}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: mediums.id }).from(mediums).where(eq(mediums.id, mediumT2));

      expect(rows).toHaveLength(1);
    });
  });

  describe('group 11 — semester / period delete safety', () => {
    it('blocks deleting a period referenced by curriculum rows', async () => {
      const res = await deleteSemester(new Request(`http://x/api/academics/semesters?id=${semesterUsed}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('SEMESTER_IN_USE');
      expect(body.blockers.map((b: { key: string }) => b.key)).toContain('class_subjects');

      const rows = await db.select({ id: semesters.id }).from(semesters).where(eq(semesters.id, semesterUsed));

      expect(rows).toHaveLength(1);
    });

    it('deletes an unused period following the normal lifecycle', async () => {
      const res = await deleteSemester(new Request(`http://x/api/academics/semesters?id=${semesterUnused}`));

      expect(res.status).toBe(200);

      const rows = await db.select({ id: semesters.id }).from(semesters).where(eq(semesters.id, semesterUnused));

      expect(rows).toHaveLength(0);
    });

    it('rejects a cross-tenant period id', async () => {
      const res = await deleteSemester(new Request(`http://x/api/academics/semesters?id=${semesterT2}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: semesters.id }).from(semesters).where(eq(semesters.id, semesterT2));

      expect(rows).toHaveLength(1);
    });

    it('rejects out-of-range month values (current exposed validation only; overlap detection is not part of this model)', async () => {
      const { POST } = await import('@/app/api/academics/semesters/route');

      const res = await POST(new Request('http://x/api/academics/semesters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `Bad-${suffix}`, startMonth: 13, endMonth: 2 }),
      }));

      expect(res.status).toBe(422);
    });
  });

  describe('group 12 — shift delete safety', () => {
    it('blocks deleting a shift referenced by classes and does not claim a timetable link that does not exist', async () => {
      const res = await deleteShift(new Request(`http://x/api/academics/shifts?id=${shiftUsed}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('SHIFT_IN_USE');

      const keys = body.blockers.map((b: { key: string }) => b.key);

      expect(keys).toContain('classes');
      expect(keys).not.toContain('timetable_slots');

      const rows = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.id, shiftUsed));

      expect(rows).toHaveLength(1);
    });

    it('deletes an unused shift following the normal lifecycle', async () => {
      const res = await deleteShift(new Request(`http://x/api/academics/shifts?id=${shiftUnused}`));

      expect(res.status).toBe(200);

      const rows = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.id, shiftUnused));

      expect(rows).toHaveLength(0);
    });

    it('rejects a cross-tenant shift id', async () => {
      const res = await deleteShift(new Request(`http://x/api/academics/shifts?id=${shiftT2}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.id, shiftT2));

      expect(rows).toHaveLength(1);
    });
  });

  describe('group 13 — subject delete / coefficient integrity', () => {
    it('blocks deleting a subject used by curriculum and teacher assignments with structured blockers', async () => {
      const res = await deleteSubject(new Request(`http://x/api/academics/subjects?id=${subjectUsed}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('SUBJECT_IN_USE');

      const keys = body.blockers.map((b: { key: string }) => b.key);

      expect(keys).toContain('class_subjects');
      expect(keys).toContain('subject_teacher_assignments');

      const rows = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectUsed));

      expect(rows).toHaveLength(1);
    });

    it('preserves curriculum configuration and teacher assignment context after a blocked delete', async () => {
      await deleteSubject(new Request(`http://x/api/academics/subjects?id=${subjectUsed}`));

      const [cs] = await db
        .select({
          coefficient: classSubjects.coefficient,
          weeklyMinutes: classSubjects.weeklyMinutes,
          displayOrder: classSubjects.displayOrder,
          curriculumLabel: classSubjects.curriculumLabel,
          isActive: classSubjects.isActive,
        })
        .from(classSubjects)
        .where(eq(classSubjects.id, classSubjectId));

      expect(Number(cs!.coefficient)).toBe(3.5);
      expect(cs!.weeklyMinutes).toBe(180);
      expect(cs!.displayOrder).toBe(2);
      expect(cs!.curriculumLabel).toBe(`Cadre-${suffix}`);
      expect(cs!.isActive).toBe(true);

      const [st] = await db
        .select({ subjectId: subjectTeachers.subjectId, classSubjectId: subjectTeachers.classSubjectId })
        .from(subjectTeachers)
        .where(eq(subjectTeachers.id, subjectTeacherId));

      expect(st!.subjectId).toBe(subjectUsed);
      expect(st!.classSubjectId).toBe(classSubjectId);
    });

    it('deletes a clean unused subject', async () => {
      const res = await deleteSubject(new Request(`http://x/api/academics/subjects?id=${subjectUnused}`));

      expect(res.status).toBe(200);

      const rows = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectUnused));

      expect(rows).toHaveLength(0);
    });

    it('rejects a cross-tenant subject id', async () => {
      const res = await deleteSubject(new Request(`http://x/api/academics/subjects?id=${subjectT2}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectT2));

      expect(rows).toHaveLength(1);
    });
  });
});
