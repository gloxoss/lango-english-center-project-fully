import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as history } from '@/app/api/attendance/history/route';
import { db } from '@/libs/DB';
import {
  attendance,
  branches,
  classes,
  classSections,
  classTeachers,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// Phase 8: the history surface must be scoped SERVER-SIDE. A head of year may
// only read their own sections and a campus-limited admin only their campus —
// the filters a caller sends must not be able to widen either.

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

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `HIST-ADMIN-${suffix}`;
const TEACHER = `HIST-TEACHER-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const DATE = '2026-09-22'; // a Tuesday, inside the session year

let branchA = '';
let branchB = '';
let sectionA = '';
let sectionB = '';
let sessionYearId = '';

async function as(userId: string, role: string, branchId: string | null = null) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId, role, branchId } as RequestContext);
}

function get(query = '') {
  return history(new Request(`http://x/api/attendance/history?from=${DATE}&to=${DATE}${query}`));
}

async function ids(query = '') {
  const res = await get(query);
  const json = await res.json() as any;
  return (json.data as { studentId: string }[]).map(r => r.studentId).sort();
}

describe.skipIf(!dbReachable)('attendance history scope — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Hist ${suffix}`, slug: `hist-${suffix}` });

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `HA-${suffix}`, code: `HA-${suffix}` },
      { tenantId, name: `HB-${suffix}`, code: `HB-${suffix}` },
    ]).returning();

    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branchA, name: 'Hist Admin', email: `ha-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER, tenantId, branchId: branchA, name: 'Hist Teacher', email: `ht-${suffix}@t.local`, role: 'teacher' },
      { id: STUDENT_A, tenantId, branchId: branchA, name: 'Student A', email: `sa-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branchB, name: 'Student B', email: `sb-${suffix}@t.local`, role: 'student' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId, name: `SY-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true,
    }).returning();
    sessionYearId = sessionYear!.id;

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `CA-${suffix}`, mediumId: medium!.id },
      { tenantId, branchId: branchB, name: `CB-${suffix}`, mediumId: medium!.id },
    ]).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `SA-${suffix}` },
      { tenantId, name: `SB-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: classRows[0]!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: classRows[1]!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();

    sectionA = csRows[0]!.id;
    sectionB = csRows[1]!.id;

    // The teacher holds section A only.
    await db.insert(classTeachers).values({
      tenantId, classSectionId: sectionA, teacherId: TEACHER, role: 'primary', status: 'active',
    });

    await db.insert(attendance).values([
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionYearId, date: DATE, period: 1, status: 'present', isVoided: false },
      { tenantId, studentId: STUDENT_B, classSectionId: sectionB, academicYearId: sessionYearId, date: DATE, period: 1, status: 'absent', isVoided: false },
    ]);
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('H8.1: a tenant-wide admin sees both campuses', async () => {
    await as(ADMIN, 'school_admin', null);
    expect(await ids()).toEqual([STUDENT_A, STUDENT_B].sort());
  });

  it('H8.2: a campus-limited admin sees only their own campus', async () => {
    await as(ADMIN, 'school_admin', branchA);

    const seen = await ids();

    expect(seen).toEqual([STUDENT_A]);
    expect(seen).not.toContain(STUDENT_B);
  });

  it('H8.3: a teacher sees only the sections they teach', async () => {
    await as(TEACHER, 'teacher', branchA);

    const seen = await ids();

    expect(seen).toEqual([STUDENT_A]);
    expect(seen).not.toContain(STUDENT_B);
  });

  it('H8.4: a filter cannot widen the caller scope', async () => {
    // Asking for the other section by id must not defeat the teacher scope.
    await as(TEACHER, 'teacher', branchA);

    const seen = await ids(`&classSectionId=${sectionB}`);

    expect(seen).toEqual([]);
  });

  it('H8.5: the query string cannot move the tenant boundary', async () => {
    await as(ADMIN, 'school_admin', null);

    const res = await get(`&tenantId=${crypto.randomUUID()}`);
    const json = await res.json() as any;

    // Unknown params are ignored, not honoured.
    expect(res.status).toBe(200);
    expect((json.data as { studentId: string }[]).length).toBe(2);
  });
});
