import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/libs/api/context';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getAttendance, POST as postAttendance } from '@/app/api/attendance/route';
import { POST as postAutoPlacement } from '@/app/api/students/placements/auto/route';
import { POST as postPlacement } from '@/app/api/students/placements/route';
import { db } from '@/libs/DB';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import {
  attendance,
  branches,
  classes,
  classSections,
  mediums,
  sections,
  sessionYears,
  studentPlacements,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed proof for:
//   GROUP 4  student placement integration (session/branch truth, history)
//   GROUP 6  attendance section scope (migration 0147)
//   GROUP 15 transactional safety (auto-placement exact commit)

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
const date = '2026-10-05';

const ADMIN = `USR-P0A-AD-${suffix}`;
const ADMIN_A = `USR-P0A-AA-${suffix}`;
// Auto-placement commit requires uuid student ids (z.string().uuid()).
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const STUDENT_OTHER = crypto.randomUUID();
const STUDENT_UNPLACED = crypto.randomUUID();

let branchA = '';
let branchOther = '';
let mediumId = '';
let yearId = '';
let yearOther = '';
let classId = '';
let csA = '';
let csB = '';
let csOther = '';

async function asRole(userId: string, role: string, branchId: string | null = null, tid = tenantId) {
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

async function placementsOf(studentId: string) {
  return db.select().from(studentPlacements).where(eq(studentPlacements.studentId, studentId));
}

async function attendanceOf(studentId: string) {
  return db
    .select({ classSectionId: attendance.classSectionId, studentGroupId: attendance.studentGroupId })
    .from(attendance)
    .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId)));
}

describe.skipIf(!dbReachable)('academic attendance + placement P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `P0 Att ${suffix}`, slug: `p0-att-${suffix}` },
      { id: otherTenantId, name: `P0 Att Other ${suffix}`, slug: `p0-att-x-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `Campus A ${suffix}`, code: `P0AA-${suffix}` },
      { tenantId, name: `Campus O ${suffix}`, code: `P0AO-${suffix}` },
    ]).returning();
    branchA = branchRows[0]!.id;
    branchOther = branchRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: null, name: 'Admin', email: `p0a-ad-${suffix}@t.local`, role: 'school_admin' },
      { id: ADMIN_A, tenantId, branchId: branchA, name: 'Admin A', email: `p0a-aa-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT_A, tenantId, branchId: branchA, name: 'Student A', email: `p0a-sa-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branchA, name: 'Student B', email: `p0a-sb-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_OTHER, tenantId, branchId: branchOther, name: 'Student Other', email: `p0a-so-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_UNPLACED, tenantId, branchId: branchA, name: 'Student Unplaced', email: `p0a-su-${suffix}@t.local`, role: 'student' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    mediumId = medium!.id;
    await db.insert(mediums).values({ tenantId: otherTenantId, name: `FR-${suffix}` });

    const [year] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    yearId = year!.id;
    const [year2] = await db.insert(sessionYears).values({
      tenantId: otherTenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    yearOther = year2!.id;

    const [cls] = await db.insert(classes).values({ tenantId, branchId: branchA, name: `2nde-${suffix}`, mediumId }).returning();
    classId = cls!.id;

    const labelRows = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `B-${suffix}` },
      { tenantId, name: `O-${suffix}` },
    ]).returning();

    const sectionRows = await db.insert(classSections).values([
      { tenantId, classId, sectionId: labelRows[0]!.id, mediumId, maxStudents: 5 },
      { tenantId, classId, sectionId: labelRows[1]!.id, mediumId, maxStudents: 5 },
      { tenantId, classId, sectionId: labelRows[2]!.id, mediumId, maxStudents: 5 },
    ]).returning();
    csA = sectionRows[0]!.id;
    csB = sectionRows[1]!.id;
    csOther = sectionRows[2]!.id;

    // Baseline placement truth for the fixture students: the compatibility
    // projection and the placement history must agree from the start.
    await recordStudentPlacement({ tenantId, studentId: STUDENT_A, sessionYearId: yearId, classSectionId: csA });
    await recordStudentPlacement({ tenantId, studentId: STUDENT_B, sessionYearId: yearId, classSectionId: csB });
    await recordStudentPlacement({ tenantId, studentId: STUDENT_OTHER, sessionYearId: yearId, classSectionId: csOther });
  });

  beforeEach(async () => {
    await asRole(ADMIN, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, otherTenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, otherTenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  // -------------------------------------------------------------------------
  // GROUP 6 — attendance section scope
  // -------------------------------------------------------------------------
  describe('group 6 — attendance section scope (0147)', () => {
    it('stores the operating section and parent class on every mark', async () => {
      const res = await postAttendance(jsonRequest('http://x/api/attendance', 'POST', {
        date,
        studentGroupId: csA,
        period: 1,
        records: [{ studentId: STUDENT_A, status: 'present' }],
      }));

      expect(res.status).toBe(200);

      const rows = await attendanceOf(STUDENT_A);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.classSectionId).toBe(csA);
      expect(rows[0]!.studentGroupId).toBe(classId);
    });

    it('keeps sibling sections independent — no cross-section contamination', async () => {
      const res = await postAttendance(jsonRequest('http://x/api/attendance', 'POST', {
        date,
        studentGroupId: csB,
        period: 1,
        records: [{ studentId: STUDENT_B, status: 'absent' }],
      }));

      expect(res.status).toBe(200);

      const sectionA = await bodyOf(await getAttendance(new Request(`http://x/api/attendance?date=${date}&classId=${csA}`)));
      const sectionB = await bodyOf(await getAttendance(new Request(`http://x/api/attendance?date=${date}&classId=${csB}`)));

      expect(sectionA.data.map((r: { studentId: string }) => r.studentId)).toEqual([STUDENT_A]);
      expect(sectionB.data.map((r: { studentId: string }) => r.studentId)).toEqual([STUDENT_B]);
    });

    it('historical attendance stays attached to the original section after the student moves', async () => {
      await recordStudentPlacement({
        tenantId,
        studentId: STUDENT_A,
        sessionYearId: yearId,
        classSectionId: csB,
        startDate: '2026-12-01',
      });

      const [student] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, STUDENT_A));

      expect(student!.classSectionId).toBe(csB);

      const rows = await attendanceOf(STUDENT_A);

      expect(rows[0]!.classSectionId).toBe(csA);

      const sectionA = await bodyOf(await getAttendance(new Request(`http://x/api/attendance?date=${date}&classId=${csA}`)));

      expect(sectionA.data.map((r: { studentId: string }) => r.studentId)).toContain(STUDENT_A);

      const sectionB = await bodyOf(await getAttendance(new Request(`http://x/api/attendance?date=${date}&classId=${csB}`)));

      expect(sectionB.data.map((r: { studentId: string }) => r.studentId)).not.toContain(STUDENT_A);
    });

    it('branch-limited admin cannot read or write another branch attendance', async () => {
      await asRole(ADMIN_A, 'school_admin', branchA);

      const read = await bodyOf(await getAttendance(new Request(`http://x/api/attendance?date=${date}`)));
      const ids = read.data.map((r: { studentId: string }) => r.studentId);

      expect(ids).not.toContain(STUDENT_OTHER);

      const write = await postAttendance(jsonRequest('http://x/api/attendance', 'POST', {
        date: '2026-10-06',
        studentGroupId: csOther,
        period: 1,
        records: [{ studentId: STUDENT_OTHER, status: 'present' }],
      }));

      expect(write.status).toBe(403);

      const rows = await attendanceOf(STUDENT_OTHER);

      expect(rows).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 4 — student placement integration
  // -------------------------------------------------------------------------
  describe('group 4 — student placement integration', () => {
    it('placement session is validated against the tenant', async () => {
      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_UNPLACED,
        sessionYearId: yearOther,
        classSectionId: csA,
      }));

      expect(res.status).toBe(404);
      expect((await bodyOf(res)).error.code).toBe('SESSION_YEAR_NOT_FOUND');

      const cross = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_UNPLACED,
        sessionYearId: yearId,
        classSectionId: csA,
      }));

      expect(cross.status).toBe(201);

      const rows = await placementsOf(STUDENT_UNPLACED);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.sessionYearId).toBe(yearId);
    });

    it('same-day section change keeps exactly one current placement', async () => {
      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_UNPLACED,
        sessionYearId: yearId,
        classSectionId: csB,
      }));

      expect(res.status).toBe(201);

      const rows = await placementsOf(STUDENT_UNPLACED);

      expect(rows.filter(r => r.isCurrent)).toHaveLength(1);
      expect(rows.find(r => r.isCurrent)!.classSectionId).toBe(csB);
    });

    it('a dated move closes the old placement instead of erasing it', async () => {
      const before = await placementsOf(STUDENT_UNPLACED);

      const res = await postPlacement(nextJsonRequest('http://x/api/students/placements', 'POST', {
        studentId: STUDENT_UNPLACED,
        sessionYearId: yearId,
        classSectionId: csA,
        startDate: '2027-02-01',
      }));

      expect(res.status).toBe(201);

      const after = await placementsOf(STUDENT_UNPLACED);

      expect(after.length).toBe(before.length + 1);
      expect(after.filter(r => r.isCurrent)).toHaveLength(1);

      const closed = after.find(r => !r.isCurrent && r.endDate === '2027-02-01');

      expect(closed).toBeTruthy();
    });

    it('active student count per section reconciles with placement truth', async () => {
      const rows = await db
        .select({ classSectionId: user.classSectionId, n: count() })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .groupBy(user.classSectionId);

      for (const row of rows) {
        if (!row.classSectionId) {
          continue;
        }
        const [current] = await db
          .select({ n: count() })
          .from(studentPlacements)
          .where(and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.classSectionId, row.classSectionId),
            eq(studentPlacements.isCurrent, true),
          ));

        expect(Number(current!.n)).toBe(Number(row.n));
      }
    });
  });

  // -------------------------------------------------------------------------
  // GROUP 15 — transactional safety (auto-placement exact commit)
  // -------------------------------------------------------------------------
  describe('group 15 — transactional safety', () => {
    it('a stale roster fingerprint refuses the commit and writes nothing', async () => {
      const before = await placementsOf(STUDENT_B);

      const res = await postAutoPlacement(nextJsonRequest('http://x/api/students/placements/auto', 'POST', {
        sessionYearId: yearId,
        classId,
        dryRun: false,
        assignments: [{ studentId: STUDENT_UNPLACED, targetClassSectionId: csA }],
        rosterFingerprint: 'a'.repeat(64),
      }));

      expect(res.status).toBe(409);
      expect((await bodyOf(res)).error.code).toBe('ROSTER_CHANGED');

      const afterUnplaced = await placementsOf(STUDENT_UNPLACED);

      expect(afterUnplaced.filter(r => r.isCurrent).length).toBe(1);
      expect(afterUnplaced.find(r => r.isCurrent)!.classSectionId).toBe(csA);

      const afterB = await placementsOf(STUDENT_B);

      expect(afterB.length).toBe(before.length);
    });

    it('a matching fingerprint applies exactly the previewed assignments', async () => {
      const [fresh] = await db.insert(user).values({
        id: crypto.randomUUID(),
        tenantId,
        branchId: branchA,
        name: 'Student Fresh',
        email: `p0a-sf-${suffix}@t.local`,
        role: 'student',
      }).returning();

      const dry = await postAutoPlacement(nextJsonRequest('http://x/api/students/placements/auto', 'POST', {
        sessionYearId: yearId,
        classId,
        dryRun: true,
      }));

      expect(dry.status).toBe(200);

      const preview = await bodyOf(dry);

      expect(preview.data.rosterFingerprint).toBeTruthy();
      expect(preview.data.assignments.length).toBeGreaterThanOrEqual(1);

      const commit = await postAutoPlacement(nextJsonRequest('http://x/api/students/placements/auto', 'POST', {
        sessionYearId: yearId,
        classId,
        dryRun: false,
        assignments: preview.data.assignments.map((a: { studentId: string; targetClassSectionId: string }) => ({
          studentId: a.studentId,
          targetClassSectionId: a.targetClassSectionId,
        })),
        rosterFingerprint: preview.data.rosterFingerprint,
      }));

      expect(commit.status).toBe(200);

      const committed = await placementsOf(fresh!.id);

      expect(committed.filter(r => r.isCurrent)).toHaveLength(1);
    });
  });
});
