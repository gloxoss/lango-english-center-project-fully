import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteSection, GET as getSections, POST as postSection, PUT as putSection } from '@/app/api/academics/class-sections/route';
import { POST as postClassSubject } from '@/app/api/academics/class-subjects/route';
import { POST as postClassTeacher } from '@/app/api/academics/class-teachers/route';
import { DELETE as deleteClass, GET as getClasses, POST as postClass, PUT as putClass } from '@/app/api/academics/classes/route';
import { DELETE as deleteSubjectTeacher, GET as getSubjectTeachers, POST as postSubjectTeacher } from '@/app/api/academics/subject-teachers/route';
import { POST as postPlacement } from '@/app/api/students/placements/route';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  classTeachers,
  mediums,
  sections,
  sessionYears,
  studentPlacements,
  subjects,
  subjectTeachers,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed proof for the Academic Structure hardening:
//   GROUP 1  branch isolation / IDOR (direct + nested)
//   GROUP 2  capacity single source of truth
//   GROUP 3  delete/archive blockers (no silent history cascade)
//   GROUP 5  teacher assignment history (migration 0146)
//   GROUP 8  class != section identity
//   GROUP 16 tenant isolation
//   GROUP 17 authorization boundaries
//
// Fixtures are isolated per run (random tenant ids) and cleaned up in afterAll.

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

const ADMIN_ALL = `USR-P0-ALL-${suffix}`;
const ADMIN_A = `USR-P0-A-${suffix}`;
const TEACHER_A = `USR-P0-T-${suffix}`;
const TEACHER_B = `USR-P0-TB-${suffix}`;
const TEACHER_OLD = `USR-P0-TO-${suffix}`;
const TEACHER_CLEAN = `USR-P0-TC-${suffix}`;
const STUDENT_A1 = `USR-P0-SA1-${suffix}`;
const STUDENT_A2 = `USR-P0-SA2-${suffix}`;
const STUDENT_NEW = `USR-P0-SN-${suffix}`;
const STUDENT_B1 = `USR-P0-SB1-${suffix}`;
const STUDENT_T2 = `USR-P0-ST2-${suffix}`;

let branchA = '';
let branchB = '';
let mediumId = '';
let mediumT2 = '';
let yearId = '';
let classA = '';
let classB = '';
let classEmpty = '';
let classT2 = '';
let csA1 = '';
let csA2 = '';
let csMove = '';
let csBelow = '';
let csB1 = '';
let csEmpty = '';
let csT2 = '';
let subjectMath = '';
let subjectT2 = '';
let classSubjectA = '';

async function asRole(userId: string, role: string, tid = tenantId, branchId: string | null = null) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role, branchId } as RequestContext);
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function nextJsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest;
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

async function occupancyOf(sectionId: string): Promise<number> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.classSectionId, sectionId));
  return rows.length;
}

describe.skipIf(!dbReachable)('academic structure P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `P0 Structure ${suffix}`, slug: `p0-struct-${suffix}` },
      { id: otherTenantId, name: `P0 Other ${suffix}`, slug: `p0-other-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `Campus A ${suffix}`, code: `P0A-${suffix}` },
      { tenantId, name: `Campus B ${suffix}`, code: `P0B-${suffix}` },
      { tenantId: otherTenantId, name: `Campus T2 ${suffix}`, code: `P0T2-${suffix}` },
    ]).returning();
    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN_ALL, tenantId, branchId: null, name: 'Admin All', email: `p0-all-${suffix}@t.local`, role: 'school_admin' },
      { id: ADMIN_A, tenantId, branchId: branchA, name: 'Admin A', email: `p0-a-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER_A, tenantId, branchId: branchA, name: 'Teacher A', email: `p0-ta-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_B, tenantId, branchId: branchA, name: 'Teacher B', email: `p0-tb-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_OLD, tenantId, branchId: branchA, name: 'Teacher Old', email: `p0-to-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_CLEAN, tenantId, branchId: branchA, name: 'Teacher Clean', email: `p0-tc-${suffix}@t.local`, role: 'teacher' },
      { id: STUDENT_A1, tenantId, branchId: branchA, name: 'Student A1', email: `p0-sa1-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_A2, tenantId, branchId: branchA, name: 'Student A2', email: `p0-sa2-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_NEW, tenantId, branchId: branchA, name: 'Student New', email: `p0-sn-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B1, tenantId, branchId: branchB, name: 'Student B1', email: `p0-sb1-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_T2, tenantId: otherTenantId, branchId: branchRows[2]!.id, name: 'Student T2', email: `p0-st2-${suffix}@t.local`, role: 'student' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    mediumId = medium!.id;
    const [mediumOther] = await db.insert(mediums).values({ tenantId: otherTenantId, name: `FR-${suffix}` }).returning();
    mediumT2 = mediumOther!.id;

    const [year] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    yearId = year!.id;

    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `2nde-${suffix}`, mediumId },
      { tenantId, branchId: branchB, name: `3nde-${suffix}`, mediumId },
      { tenantId, branchId: branchA, name: `Empty-${suffix}`, mediumId },
      { tenantId: otherTenantId, branchId: branchRows[2]!.id, name: `T2Class-${suffix}`, mediumId: mediumT2 },
    ]).returning();
    classA = classRows[0]!.id;
    classB = classRows[1]!.id;
    classEmpty = classRows[2]!.id;
    classT2 = classRows[3]!.id;

    const labelRows = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `C-${suffix}` },
      { tenantId, name: `M-${suffix}` },
      { tenantId, name: `B-${suffix}` },
      { tenantId, name: `D-${suffix}` },
      { tenantId, name: `E-${suffix}` },
      { tenantId, name: `T2-${suffix}` },
      { tenantId: otherTenantId, name: `T2B-${suffix}` },
    ]).returning();

    const sectionRows = await db.insert(classSections).values([
      { tenantId, classId: classA, sectionId: labelRows[0]!.id, mediumId, maxStudents: 2 },
      { tenantId, classId: classA, sectionId: labelRows[1]!.id, mediumId, maxStudents: null },
      { tenantId, classId: classA, sectionId: labelRows[2]!.id, mediumId, maxStudents: 5 },
      { tenantId, classId: classA, sectionId: labelRows[4]!.id, mediumId, maxStudents: 2 },
      { tenantId, classId: classB, sectionId: labelRows[3]!.id, mediumId, maxStudents: 1 },
      { tenantId, classId: classEmpty, sectionId: labelRows[5]!.id, mediumId, maxStudents: 1 },
      { tenantId: otherTenantId, classId: classT2, sectionId: labelRows[7]!.id, mediumId: mediumT2, maxStudents: 1 },
    ]).returning();
    csA1 = sectionRows[0]!.id;
    csA2 = sectionRows[1]!.id;
    csMove = sectionRows[2]!.id;
    csBelow = sectionRows[3]!.id;
    csB1 = sectionRows[4]!.id;
    csEmpty = sectionRows[5]!.id;
    csT2 = sectionRows[6]!.id;

    const subjectRows = await db.insert(subjects).values([
      { tenantId, name: `Maths-${suffix}`, mediumId, type: 'theory' },
      { tenantId: otherTenantId, name: `MathsT2-${suffix}`, mediumId: mediumT2, type: 'theory' },
    ]).returning();
    subjectMath = subjectRows[0]!.id;
    subjectT2 = subjectRows[1]!.id;

    const [classSubjectRow] = await db.insert(classSubjects).values([
      { tenantId, classId: classA, subjectId: subjectMath, type: 'compulsory' },
    ]).returning();
    classSubjectA = classSubjectRow!.id;

    // Baseline compatibility projection: A1 sits in section A1.
    await db.update(user).set({ classSectionId: csA1 }).where(eq(user.id, STUDENT_A1));
  });

  beforeEach(async () => {
    await asRole(ADMIN_ALL, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, otherTenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, otherTenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, otherTenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, otherTenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, otherTenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, otherTenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  // -------------------------------------------------------------------------
  // GROUP 1 — branch isolation / IDOR
  // -------------------------------------------------------------------------
  describe('group 1 — branch isolation / IDOR', () => {
    it('branch-limited admin list read is pinned to their campus even with a branchId query bypass', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await getClasses(new Request(`http://x/api/academics/classes?pageSize=100&branchId=${branchB}`));
      const body = await bodyOf(res);

      expect(res.status).toBe(200);

      const names = body.data.map((c: { name: string }) => c.name);

      expect(names).toContain(`2nde-${suffix}`);
      expect(names).not.toContain(`3nde-${suffix}`);
    });

    it('cannot edit another branch class (404) and the row is unchanged', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await putClass(jsonRequest('http://x/api/academics/classes', 'PUT', { id: classB, name: 'HACKED' }));

      expect(res.status).toBe(404);

      const [row] = await db.select({ name: classes.name }).from(classes).where(eq(classes.id, classB));

      expect(row!.name).toBe(`3nde-${suffix}`);
    });

    it('cannot delete another branch class (404)', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await deleteClass(new Request(`http://x/api/academics/classes?id=${classB}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, classB));

      expect(rows).toHaveLength(1);
    });

    it('cannot read or edit another branch section capacity (nested resource)', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const read = await getSections(new Request(`http://x/api/academics/class-sections?classId=${classB}&pageSize=100`));
      const readBody = await bodyOf(read);

      expect(read.status).toBe(200);
      expect(readBody.data).toHaveLength(0);

      const edit = await putSection(jsonRequest('http://x/api/academics/class-sections', 'PUT', { id: csB1, maxStudents: 99 }));

      expect(edit.status).toBe(404);

      const [row] = await db.select({ maxStudents: classSections.maxStudents }).from(classSections).where(eq(classSections.id, csB1));

      expect(row!.maxStudents).toBe(1);
    });

    it('cannot delete another branch section', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await deleteSection(new Request(`http://x/api/academics/class-sections?id=${csB1}`));

      expect(res.status).toBe(404);

      const rows = await db.select({ id: classSections.id }).from(classSections).where(eq(classSections.id, csB1));

      expect(rows).toHaveLength(1);
    });

    it('cannot assign a teacher to another branch section', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await postClassTeacher(jsonRequest('http://x/api/academics/class-teachers', 'POST', {
        classSectionId: csB1,
        teacherId: TEACHER_A,
        role: 'primary',
      }));

      expect(res.status).toBe(422);
      expect((await bodyOf(res)).error.code).toBe('CROSS_BRANCH_ASSIGNMENT');
    });

    it('cannot place a student into another branch section', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A2,
        sessionYearId: yearId,
        classSectionId: csB1,
      }));

      expect(res.status).toBe(403);

      await asRole(ADMIN_ALL, 'school_admin');
      const crossStudent = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_B1,
        sessionYearId: yearId,
        classSectionId: csA1,
      }));

      expect(crossStudent.status).toBe(422);
      expect((await bodyOf(crossStudent)).error.code).toBe('CROSS_BRANCH_ASSIGNMENT');
    });

    it('a body branchId cannot be used to bypass the writer branch pin', async () => {
      await asRole(ADMIN_A, 'school_admin', tenantId, branchA);

      const explicit = await postClass(jsonRequest('http://x/api/academics/classes', 'POST', {
        name: `Bypass-${suffix}`,
        mediumId,
        branchId: branchB,
      }));

      expect(explicit.status).toBe(403);

      const pinned = await postClass(jsonRequest('http://x/api/academics/classes', 'POST', {
        name: `Pinned-${suffix}`,
        mediumId,
      }));

      expect(pinned.status).toBeLessThan(300);

      const body = await bodyOf(pinned);

      const [row] = await db.select({ branchId: classes.branchId }).from(classes).where(eq(classes.id, body.data.id));

      expect(row!.branchId).toBe(branchA);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 2 — capacity single source of truth
  // -------------------------------------------------------------------------
  describe('group 2 — capacity single source of truth', () => {
    it('unconfigured capacity blocks a placement with CAPACITY_NOT_CONFIGURED', async () => {
      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A2,
        sessionYearId: yearId,
        classSectionId: csA2,
      }));

      expect(res.status).toBe(422);
      expect((await bodyOf(res)).error.code).toBe('CAPACITY_NOT_CONFIGURED');
    });

    it('at capacity blocks the next placement with CAPACITY_EXCEEDED', async () => {
      const first = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A1,
        sessionYearId: yearId,
        classSectionId: csA1,
      }));

      expect(first.status).toBe(201);

      const second = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A2,
        sessionYearId: yearId,
        classSectionId: csA1,
      }));

      expect(second.status).toBe(201);
      expect(await occupancyOf(csA1)).toBe(2);

      const third = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_NEW,
        sessionYearId: yearId,
        classSectionId: csA1,
      }));

      expect(third.status).toBe(409);
      expect((await bodyOf(third)).error.code).toBe('CAPACITY_EXCEEDED');
      expect(await occupancyOf(csA1)).toBe(2);
    });

    it('re-placing the same student is a no-op that keeps their own seat', async () => {
      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A1,
        sessionYearId: yearId,
        classSectionId: csA1,
      }));

      expect(res.status).toBe(201);
      expect(await occupancyOf(csA1)).toBe(2);

      const rows = await db.select({ isCurrent: studentPlacements.isCurrent }).from(studentPlacements).where(eq(studentPlacements.studentId, STUDENT_A1));

      expect(rows.filter(r => r.isCurrent)).toHaveLength(1);
    });

    it('a move decrements the source and increments the destination, closing the old row', async () => {
      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A2,
        sessionYearId: yearId,
        classSectionId: csMove,
        startDate: '2026-12-01',
      }));

      expect(res.status).toBe(201);
      expect(await occupancyOf(csA1)).toBe(1);
      expect(await occupancyOf(csMove)).toBe(1);

      const rows = await db
        .select({ isCurrent: studentPlacements.isCurrent, classSectionId: studentPlacements.classSectionId })
        .from(studentPlacements)
        .where(eq(studentPlacements.studentId, STUDENT_A2));

      expect(rows.filter(r => r.isCurrent)).toHaveLength(1);
      expect(rows.find(r => r.isCurrent)!.classSectionId).toBe(csMove);
      expect(rows.filter(r => !r.isCurrent).length).toBeGreaterThanOrEqual(1);
    });

    it('refuses shrinking capacity below the seated students (CAPACITY_BELOW_OCCUPANCY)', async () => {
      const placeA = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_A2,
        sessionYearId: yearId,
        classSectionId: csBelow,
        startDate: '2027-01-05',
      }));

      expect(placeA.status).toBe(201);

      const placeB = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_NEW,
        sessionYearId: yearId,
        classSectionId: csBelow,
      }));

      expect(placeB.status).toBe(201);
      expect(await occupancyOf(csBelow)).toBe(2);

      const res = await putSection(jsonRequest('http://x/api/academics/class-sections', 'PUT', { id: csBelow, maxStudents: 1 }));

      expect(res.status).toBe(409);
      expect((await bodyOf(res)).error.code).toBe('CAPACITY_BELOW_OCCUPANCY');

      const [row] = await db.select({ maxStudents: classSections.maxStudents }).from(classSections).where(eq(classSections.id, csBelow));

      expect(row!.maxStudents).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 3 — delete / archive blockers
  // -------------------------------------------------------------------------
  describe('group 3 — delete/archive blockers', () => {
    it('class delete is blocked with CLASS_IN_USE and structured blockers', async () => {
      const res = await deleteClass(new Request(`http://x/api/academics/classes?id=${classA}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('CLASS_IN_USE');

      const keys = body.blockers.map((b: { key: string }) => b.key);

      expect(keys).toContain('sections');
      expect(keys).toContain('student_placements');

      const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, classA));

      expect(rows).toHaveLength(1);
    });

    it('section delete is blocked with SECTION_IN_USE when placements exist', async () => {
      const res = await deleteSection(new Request(`http://x/api/academics/class-sections?id=${csA1}`));

      expect(res.status).toBe(409);

      const body = await bodyOf(res);

      expect(body.error.code).toBe('SECTION_IN_USE');

      const keys = body.blockers.map((b: { key: string }) => b.key);

      expect(keys).toContain('student_placements');
      expect(keys).toContain('enrolled_students');

      const rows = await db.select({ id: classSections.id }).from(classSections).where(eq(classSections.id, csA1));

      expect(rows).toHaveLength(1);
    });

    it('an unreferenced section and class can still be deleted', async () => {
      const sectionRes = await deleteSection(new Request(`http://x/api/academics/class-sections?id=${csEmpty}`));

      expect(sectionRes.status).toBe(200);

      const classRes = await deleteClass(new Request(`http://x/api/academics/classes?id=${classEmpty}`));

      expect(classRes.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 5 — teacher assignment history
  // -------------------------------------------------------------------------
  describe('group 5 — teacher assignment history (0146)', () => {
    it('creation stores an active assignment scoped to the default session year', async () => {
      const res = await postSubjectTeacher(jsonRequest('http://x/api/academics/subject-teachers', 'POST', {
        classSectionId: csA1,
        subjectId: subjectMath,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_A,
      }));

      expect(res.status).toBe(200);

      const body = await bodyOf(res);

      expect(body.data.status).toBe('active');
      expect(body.data.endsOn).toBeNull();
      expect(body.data.sessionYearId).toBe(yearId);
    });

    it('reassignment closes the previous row and preserves it as history', async () => {
      const res = await postSubjectTeacher(jsonRequest('http://x/api/academics/subject-teachers', 'POST', {
        classSectionId: csA1,
        subjectId: subjectMath,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_B,
      }));

      expect(res.status).toBe(200);

      const rows = await db
        .select({ teacherId: subjectTeachers.teacherId, status: subjectTeachers.status, endsOn: subjectTeachers.endsOn })
        .from(subjectTeachers)
        .where(eq(subjectTeachers.classSubjectId, classSubjectA));

      expect(rows).toHaveLength(2);

      const previous = rows.find(r => r.teacherId === TEACHER_A)!;

      expect(previous.status).toBe('inactive');
      expect(previous.endsOn).toBeTruthy();

      const current = rows.find(r => r.teacherId === TEACHER_B)!;

      expect(current.status).toBe('active');
      expect(current.endsOn).toBeNull();

      const listRes = await getSubjectTeachers(new Request(`http://x/api/academics/subject-teachers?classSubjectId=${classSubjectA}&current=1&pageSize=50`));
      const listBody = await bodyOf(listRes);

      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].teacherId).toBe(TEACHER_B);
    });

    it('cross-branch teacher assignment is blocked', async () => {
      const [classSubjectB] = await db.insert(classSubjects).values([
        { tenantId, classId: classB, subjectId: subjectMath, type: 'compulsory' },
      ]).returning();

      const res = await postSubjectTeacher(jsonRequest('http://x/api/academics/subject-teachers', 'POST', {
        classSectionId: csB1,
        subjectId: subjectMath,
        classSubjectId: classSubjectB!.id,
        teacherId: TEACHER_A,
      }));

      expect(res.status).toBe(422);
      expect((await bodyOf(res)).error.code).toBe('CROSS_BRANCH_ASSIGNMENT');

      await db.delete(classSubjects).where(eq(classSubjects.id, classSubjectB!.id));
    });

    it('destructive DELETE with teaching evidence returns SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED', async () => {
      const [active] = await db
        .select({ id: subjectTeachers.id })
        .from(subjectTeachers)
        .where(eq(subjectTeachers.teacherId, TEACHER_B));

      expect(active).toBeTruthy();

      await db.insert(classScheduleSlots).values({
        tenantId,
        classSectionId: csA1,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_B,
        dayOfWeek: 'monday',
        startTime: '08:00',
        endTime: '10:00',
      });

      const res = await deleteSubjectTeacher(new Request(`http://x/api/academics/subject-teachers?id=${active!.id}`));

      expect(res.status).toBe(409);
      expect((await bodyOf(res)).error.code).toBe('SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED');

      const [still] = await db.select({ status: subjectTeachers.status }).from(subjectTeachers).where(eq(subjectTeachers.id, active!.id));

      expect(still!.status).toBe('active');
    });

    it('a clean assignment with no evidence still hard-deletes', async () => {
      const [clean] = await db.insert(subjectTeachers).values({
        tenantId,
        classSectionId: csA2,
        subjectId: subjectMath,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_CLEAN,
        sessionYearId: yearId,
        startsOn: new Date().toISOString().slice(0, 10),
        status: 'active',
      }).returning();

      const res = await deleteSubjectTeacher(new Request(`http://x/api/academics/subject-teachers?id=${clean!.id}`));

      expect(res.status).toBe(200);

      const rows = await db.select({ id: subjectTeachers.id }).from(subjectTeachers).where(eq(subjectTeachers.id, clean!.id));

      expect(rows).toHaveLength(0);
    });

    it('session boundaries: an ended assignment is excluded from the current query', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      await db.insert(subjectTeachers).values({
        tenantId,
        classSectionId: csA2,
        subjectId: subjectMath,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_OLD,
        sessionYearId: yearId,
        startsOn: '2026-09-01',
        endsOn: yesterday,
        status: 'inactive',
      });

      const res = await getSubjectTeachers(new Request(`http://x/api/academics/subject-teachers?classSectionId=${csA2}&current=1&pageSize=50`));
      const body = await bodyOf(res);

      expect(body.data.map((r: { teacherId: string }) => r.teacherId)).not.toContain(TEACHER_OLD);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 8 — class != section identity
  // -------------------------------------------------------------------------
  describe('group 8 — class vs section identity', () => {
    it('one class projects its sections as distinct instances', async () => {
      const res = await getSections(new Request(`http://x/api/academics/class-sections?classId=${classA}&pageSize=100`));
      const body = await bodyOf(res);

      expect(body.data.length).toBeGreaterThanOrEqual(2);

      const ids = body.data.map((s: { id: string }) => s.id);

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(csA1);
      expect(ids).toContain(csA2);
    });

    it('class aggregates count sections and flag partially configured capacity without confusing ids', async () => {
      const res = await getClasses(new Request(`http://x/api/academics/classes?search=2nde-${suffix}&pageSize=10`));
      const body = await bodyOf(res);
      const row = body.data.find((c: { id: string }) => c.id === classA);

      expect(row).toBeTruthy();
      expect(row.sectionCount).toBeGreaterThanOrEqual(4);
      expect(row.capacityConfigured).toBe(false);
    });

    it('updating one section does not mutate its sibling', async () => {
      const res = await putSection(jsonRequest('http://x/api/academics/class-sections', 'PUT', { id: csA1, maxStudents: 3 }));

      expect(res.status).toBe(200);

      const rows = await db
        .select({ id: classSections.id, maxStudents: classSections.maxStudents })
        .from(classSections)
        .where(eq(classSections.classId, classA));
      const target = rows.find(r => r.id === csA1)!;
      const sibling = rows.find(r => r.id === csA2)!;

      expect(target.maxStudents).toBe(3);
      expect(sibling.maxStudents).toBeNull();
    });

    it('placements and capacity point at section instances, never the class id', async () => {
      const [placement] = await db
        .select({ classSectionId: studentPlacements.classSectionId })
        .from(studentPlacements)
        .where(eq(studentPlacements.studentId, STUDENT_A1));

      expect(placement!.classSectionId).toBe(csA1);
      expect(placement!.classSectionId).not.toBe(classA);

      const [student] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, STUDENT_A1));

      expect(student!.classSectionId).toBe(csA1);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 16 — tenant isolation
  // -------------------------------------------------------------------------
  describe('group 16 — tenant isolation', () => {
    it('class list never leaks another tenant and direct edits 404', async () => {
      const list = await getClasses(new Request('http://x/api/academics/classes?pageSize=200'));
      const body = await bodyOf(list);

      expect(body.data.map((c: { name: string }) => c.name)).not.toContain(`T2Class-${suffix}`);

      const edit = await putClass(jsonRequest('http://x/api/academics/classes', 'PUT', { id: classT2, name: 'X' }));

      expect(edit.status).toBe(404);

      const del = await deleteSection(new Request(`http://x/api/academics/class-sections?id=${csT2}`));

      expect(del.status).toBe(404);
    });

    it('cross-tenant references are rejected as INVALID_REFERENCE', async () => {
      const classSubject = await postClassSubject(jsonRequest('http://x/api/academics/class-subjects', 'POST', {
        classId: classT2,
        subjectId: subjectMath,
      }));

      expect(classSubject.status).toBe(422);

      const teacher = await postSubjectTeacher(jsonRequest('http://x/api/academics/subject-teachers', 'POST', {
        classSectionId: csT2,
        subjectId: subjectT2,
        classSubjectId: classSubjectA,
        teacherId: TEACHER_A,
      }));

      expect(teacher.status).toBe(422);

      const placement = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_T2,
        sessionYearId: yearId,
        classSectionId: csT2,
      }));

      expect(placement.status).toBe(422);
      expect((await bodyOf(placement)).error.code).toBe('INVALID_REFERENCE');
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 17 — authorization
  // -------------------------------------------------------------------------
  describe('group 17 — authorization boundaries', () => {
    it('structure mutations demand a school_admin context', async () => {
      const { requireRequestContext } = await import('@/libs/api/context');
      const callsBefore = vi.mocked(requireRequestContext).mock.calls.length;

      await postClass(jsonRequest('http://x/api/academics/classes', 'POST', { name: `Auth-${suffix}`, mediumId }));
      await postSection(jsonRequest('http://x/api/academics/class-sections', 'POST', { classId: classA, sectionId: crypto.randomUUID(), maxStudents: 1 }));

      const calls = vi.mocked(requireRequestContext).mock.calls.slice(callsBefore);

      expect(calls.length).toBeGreaterThanOrEqual(2);

      for (const call of calls) {
        expect(call[1]).toContain('school_admin');
      }
    });

    it('a capability denial (teacher without academics.manage) propagates as 403', async () => {
      const { requireCapability } = await import('@/libs/api/permissions');
      vi.mocked(requireCapability).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Capability refusée.'));

      const res = await postClass(jsonRequest('http://x/api/academics/classes', 'POST', { name: `Denied-${suffix}`, mediumId }));

      expect(res.status).toBe(403);
    });
  });
});
