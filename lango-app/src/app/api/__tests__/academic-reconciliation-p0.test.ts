import type { RequestContext } from '@/libs/api/context';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { computeMassarCoverage } from '@/libs/academics/massar-coverage';
import { db } from '@/libs/DB';
import { evaluateCapacity } from '@/libs/services/section-capacity';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import {
  attendance,
  branches,
  classes,
  classSections,
  classSubjects,
  mediums,
  sections,
  sessionYears,
  streams,
  studentPlacements,
  subjects,
  subjectTeachers,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed proof for GROUP 18 — one authoritative dataset agreeing across
// Academic Structure, Student Directory/360 projection, Teacher Directory,
// Attendance and Massar coverage. Every mismatch fails the test.

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
const ADMIN = `USR-REC-${suffix}`;
const TEACHER_ACTIVE = `USR-REC-TA-${suffix}`;
const TEACHER_CLOSED = `USR-REC-TC-${suffix}`;
const date = '2026-11-03';

let branchId = '';
let yearId = '';
let classId = '';
let secA = '';
let secB = '';
let labelA = '';
let labelB = '';
const studentsA: string[] = [];
const studentsB: string[] = [];

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId: ADMIN, tenantId, role: 'school_admin', branchId: null } as RequestContext);
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!dbReachable)('academic cross-module reconciliation P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `P0 Rec ${suffix}`, slug: `p0-rec-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `RC-${suffix}` }).returning();
    branchId = branch!.id;
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [year] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    yearId = year!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId, name: 'Admin', email: `rec-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER_ACTIVE, tenantId, branchId, name: 'Active Teacher', email: `recta-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_CLOSED, tenantId, branchId, name: 'Closed Teacher', email: `rectc-${suffix}@t.local`, role: 'teacher' },
    ]);

    const [cls] = await db.insert(classes).values({ tenantId, branchId, name: `2nde-${suffix}`, mediumId: medium!.id }).returning();
    classId = cls!.id;
    const labels = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `B-${suffix}` },
    ]).returning();
    labelA = labels[0]!.id;
    labelB = labels[1]!.id;

    const sectionsRows = await db.insert(classSections).values([
      { tenantId, classId, sectionId: labelA, mediumId: medium!.id, maxStudents: 2 },
      { tenantId, classId, sectionId: labelB, mediumId: medium!.id, maxStudents: 3 },
    ]).returning();
    secA = sectionsRows[0]!.id;
    secB = sectionsRows[1]!.id;

    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      studentsA.push(id);
      await db.insert(user).values({ id, tenantId, branchId, name: `Student A${i}`, email: `reca${i}-${suffix}@t.local`, role: 'student' });
    }
    const idB = crypto.randomUUID();
    studentsB.push(idB);
    await db.insert(user).values({ id: idB, tenantId, branchId, name: 'Student B0', email: `recb-${suffix}@t.local`, role: 'student' });

    for (const studentId of studentsA) {
      await recordStudentPlacement({ tenantId, studentId, sessionYearId: yearId, classSectionId: secA });
    }
    for (const studentId of studentsB) {
      await recordStudentPlacement({ tenantId, studentId, sessionYearId: yearId, classSectionId: secB });
    }

    const [subject] = await db.insert(subjects).values({ tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({
      tenantId,
      classId,
      subjectId: subject!.id,
      type: 'compulsory',
      coefficient: '3.00',
    }).returning();

    await db.insert(subjectTeachers).values([
      {
        tenantId,
        classSectionId: secA,
        subjectId: subject!.id,
        classSubjectId: classSubject!.id,
        teacherId: TEACHER_ACTIVE,
        sessionYearId: yearId,
        startsOn: '2026-09-01',
        status: 'active',
      },
      {
        tenantId,
        classSectionId: secA,
        subjectId: subject!.id,
        classSubjectId: classSubject!.id,
        teacherId: TEACHER_CLOSED,
        sessionYearId: yearId,
        startsOn: '2025-09-01',
        endsOn: '2026-06-30',
        status: 'inactive',
      },
    ]);

    await db.insert(streams).values([
      { tenantId, name: `SM-${suffix}`, code: `SM-${suffix}`, cycle: 'lycee', bacSeriesCode: 'SM-A' },
      { tenantId, name: `SP-${suffix}`, code: `SP-${suffix}`, cycle: 'lycee', bacSeriesCode: null },
    ]);
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(streams).where(eq(streams.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('one authoritative dataset agrees across every module', async () => {
    // Attendance marks via the real route, section-scoped.
    for (const sectionId of [secA, secB]) {
      const studentIds = sectionId === secA ? studentsA : studentsB;
      const res = await postAttendance(jsonRequest('http://x/api/attendance', 'POST', {
        date,
        studentGroupId: sectionId,
        period: 1,
        records: studentIds.map(studentId => ({ studentId, status: 'present' })),
      }));

      expect(res.status).toBe(200);
    }

    const sectionRows = await db
      .select({ id: classSections.id, maxStudents: classSections.maxStudents, classId: classSections.classId })
      .from(classSections)
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.classId, classId)));

    const report = [];
    let sumStudents = 0;
    let sumPlacements = 0;

    for (const section of sectionRows) {
      const sectionStudents = await db
        .select({ id: user.id, classSectionId: user.classSectionId })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, section.id)));

      const [placementCount] = await db
        .select({ n: count() })
        .from(studentPlacements)
        .where(and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.classSectionId, section.id),
          eq(studentPlacements.isCurrent, true),
        ));

      const [teacherCount] = await db
        .select({ n: count() })
        .from(subjectTeachers)
        .where(and(
          eq(subjectTeachers.tenantId, tenantId),
          eq(subjectTeachers.classSectionId, section.id),
          eq(subjectTeachers.status, 'active'),
        ));

      const capacity = evaluateCapacity(section.maxStudents, sectionStudents.length);

      sumStudents += sectionStudents.length;
      sumPlacements += Number(placementCount!.n);

      // Invariant: section occupancy is the placement truth, and availability
      // is capacity minus authoritative current occupancy.
      expect(sectionStudents.length).toBe(Number(placementCount!.n));
      expect(capacity.available).toBe(Math.max(0, (section.maxStudents ?? 0) - sectionStudents.length));

      report.push({
        SECTION_ID: section.id,
        CLASS: section.classId,
        BRANCH: branchId,
        ACTIVE_STUDENTS: sectionStudents.length,
        CURRENT_PLACEMENTS: Number(placementCount!.n),
        CAPACITY: section.maxStudents,
        AVAILABLE: capacity.available,
        ATTENDANCE_REGISTER_SCOPE: section.id,
        CURRENT_TEACHERS: Number(teacherCount!.n),
      });
    }

    const [activeStudents] = await db
      .select({ n: count() })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, sectionRows[0]!.id)));
    void activeStudents;

    const [currentPlacements] = await db
      .select({ n: count() })
      .from(studentPlacements)
      .where(and(eq(studentPlacements.tenantId, tenantId), eq(studentPlacements.isCurrent, true)));

    const [activeTeachers] = await db
      .select({ n: count() })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.status, 'active')));
    const [closedTeachers] = await db
      .select({ n: count() })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.status, 'inactive')));

    const [attendanceSections] = await db
      .select({ n: count() })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, date)));

    const streamRows = await db
      .select({ bacSeriesCode: streams.bacSeriesCode })
      .from(streams)
      .where(eq(streams.tenantId, tenantId));
    const massar = computeMassarCoverage(streamRows);

    // Invariants: occupancy sum equals placement truth; teacher directory
    // counts are the same rows; attendance is section-scoped; massar percent
    // matches the shared formula.
    expect(sumStudents).toBe(sumPlacements);
    expect(sumPlacements).toBe(Number(currentPlacements!.n));
    expect(Number(activeTeachers!.n)).toBe(1);
    expect(Number(closedTeachers!.n)).toBe(1);
    expect(Number(attendanceSections!.n)).toBe(4);
    expect(massar.percent).toBe(Math.round((massar.compliant / massar.eligible) * 100));

    // Student Directory projection == placement section for every student.
    for (const [sectionId, studentIds] of [[secA, studentsA], [secB, studentsB]] as const) {
      for (const studentId of studentIds) {
        const [studentRow] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, studentId));
        const [placementRow] = await db
          .select({ classSectionId: studentPlacements.classSectionId })
          .from(studentPlacements)
          .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));

        expect(studentRow!.classSectionId).toBe(sectionId);
        expect(studentRow!.classSectionId).toBe(placementRow!.classSectionId);
      }
    }

    // Attendance rows carry the section they were marked in.
    for (const [sectionId, studentIds] of [[secA, studentsA], [secB, studentsB]] as const) {
      for (const studentId of studentIds) {
        const [row] = await db
          .select({ classSectionId: attendance.classSectionId })
          .from(attendance)
          .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId), eq(attendance.date, date)));

        expect(row!.classSectionId).toBe(sectionId);
      }
    }

    // eslint-disable-next-line no-console
    console.log('[G18] reconciliation', {
      TENANT: tenantId,
      BRANCH: branchId,
      SESSION_YEAR: yearId,
      CLASS_COUNT: 1,
      SECTION_COUNT: sectionRows.length,
      SECTIONS: report,
      ACTIVE_STUDENT_COUNT: sumStudents,
      CURRENT_PLACEMENT_COUNT: Number(currentPlacements!.n),
      CURRENT_TEACHER_ASSIGNMENTS: Number(activeTeachers!.n),
      HISTORICAL_CLOSED_TEACHER_ASSIGNMENTS: Number(closedTeachers!.n),
      ATTENDANCE_SECTION_COUNT: Number(attendanceSections!.n),
      MASSAR_ELIGIBLE: massar.eligible,
      MASSAR_COMPLIANT: massar.compliant,
      MASSAR_COVERAGE: massar.percent,
    });
  });
});
