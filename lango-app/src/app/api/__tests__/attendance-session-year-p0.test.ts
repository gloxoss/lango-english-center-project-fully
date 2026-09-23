import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { PATCH as reviewExcuse, POST as postExcuse } from '@/app/api/attendance/excuses/route';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceExcuses,
  attendanceRegisters,
  attendanceSummary,
  branches,
  classes,
  classSections,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// G11 — session-year isolation (Phase 4 proof):
// G11.1 two sessions stay isolated · G11.2 summary excludes prior year
// G11.3 excuse cannot mutate another session's mark · G11.4 register session
// mismatch never reused · G11.5 mark/register session coherence
// G11.6 DATE_OUTSIDE_SESSION · G11.7 MISSING_SESSION · G11.8 legacy null-session
// registers are never treated as current.

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
const emptyTenantId = crypto.randomUUID();
const ADMIN = `USR-ASY-${suffix}`;
const STUDENT = crypto.randomUUID();
const inSessionA = '2026-03-10';
const inSessionB = '2027-03-10';
const outside = '2028-01-15';

let sectionId = '';
let sessionA = '';
let sessionB = '';

async function asAdmin(tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId: ADMIN, tenantId: tid, role: 'school_admin', branchId: null } as RequestContext);
}

function post(body: unknown, tid = tenantId): Promise<Response> {
  void tid;
  return postAttendance(new Request('http://x/api/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

async function marksOf(studentId: string, period: number) {
  return db
    .select({ id: attendance.id, status: attendance.status, year: attendance.academicYearId, date: attendance.date })
    .from(attendance)
    .where(and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.studentId, studentId),
      eq(attendance.period, period),
      eq(attendance.isVoided, false),
    ));
}

describe.skipIf(!dbReachable)('attendance session-year isolation P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `Att Sy ${suffix}`, slug: `att-sy-${suffix}` },
      { id: emptyTenantId, name: `Att Sy Empty ${suffix}`, slug: `att-sy-e-${suffix}` },
    ]);
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `SY-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Admin', email: `asy-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT, tenantId, branchId: branch!.id, name: 'Student', email: `asy-s-${suffix}@t.local`, role: 'student' },
      { id: `USR-ASY-E-${suffix}`, tenantId: emptyTenantId, branchId: null, name: 'Admin E', email: `asy-e-${suffix}@t.local`, role: 'school_admin' },
    ]);
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `1A-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `A-${suffix}` }).returning();
    const [classSection] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = classSection!.id;
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.id, STUDENT));

    const yearRows = await db.insert(sessionYears).values([
      { tenantId, name: `2025-2026-${suffix}`, startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-06-30T00:00:00.000Z', isDefault: false },
      { tenantId, name: `2026-2027-${suffix}`, startDate: '2026-09-01T00:00:00.000Z', endDate: '2027-06-30T00:00:00.000Z', isDefault: true },
    ]).returning();
    sessionA = yearRows[0]!.id;
    sessionB = yearRows[1]!.id;
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, emptyTenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, emptyTenantId));
  });

  it('G11.1 two sessions stay isolated for the same student/period', async () => {
    await db.insert(attendance).values({
      tenantId, studentId: STUDENT, classSectionId: sectionId, academicYearId: sessionA,
      date: inSessionA, period: 1, status: 'absent', isVoided: false,
    });

    const res = await post({ date: inSessionB, period: 1, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });
    expect(res.status).toBe(200);

    const marks = await marksOf(STUDENT, 1);
    expect(marks).toHaveLength(2);
    expect(new Set(marks.map(m => m.year))).toEqual(new Set([sessionA, sessionB]));

    const yearA = marks.filter(m => m.year === sessionA);
    const yearB = marks.filter(m => m.year === sessionB);
    expect(yearA).toHaveLength(1);
    expect(yearB).toHaveLength(1);
    expect(yearA[0]!.status).toBe('absent');
    expect(yearB[0]!.status).toBe('present');
  });

  it('G11.2 current-session summary excludes prior-session marks', async () => {
    const [summary] = await db
      .select({ totalSessions: attendanceSummary.totalSessions, year: attendanceSummary.academicYearId })
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, tenantId), eq(attendanceSummary.studentId, STUDENT)));

    expect(summary).toBeTruthy();
    expect(summary!.year).toBe(sessionB);
    expect(summary!.totalSessions).toBe(1);
  });

  it('G11.3 an excuse never mutates a mark belonging to another session', async () => {
    // Tampered seed: date inside session A, but owned by session B.
    await db.insert(attendance).values({
      tenantId, studentId: STUDENT, classSectionId: sectionId, academicYearId: sessionB,
      date: inSessionA, period: 2, status: 'absent', isVoided: false,
    });

    const created = await bodyOf(await postExcuse(new Request('http://x/api/attendance/excuses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: STUDENT, classSectionId: sectionId, period: 2, date: inSessionA, reason: 'cross-session probe' }),
    })));
    expect(created.success).toBe(true);

    const res = await reviewExcuse(new Request('http://x/api/attendance/excuses', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ excuseId: created.data.id, status: 'approved' }),
    }));
    expect(res.status).toBe(200);

    const [mark] = await db
      .select({ status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, STUDENT), eq(attendance.period, 2), eq(attendance.academicYearId, sessionB)));
    expect(mark!.status).toBe('absent');
  });

  it('G11.4 a register from another session is never reused', async () => {
    // Tampered seed: same section/date/period, wrong session.
    await db.insert(attendanceRegisters).values({
      tenantId, classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionId)))[0]!.classId,
      classSectionId: sectionId, sessionYearId: sessionB, date: inSessionA, period: 3, reference: `REG-TAMPER-${suffix}`, status: 'LOCKED',
    });

    const res = await post({ date: inSessionA, period: 3, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });
    expect(res.status).toBe(200);

    const registers = await db
      .select({ id: attendanceRegisters.id, year: attendanceRegisters.sessionYearId })
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.date, inSessionA), eq(attendanceRegisters.period, 3)));
    expect(registers).toHaveLength(2);
    expect(registers.some(r => r.year === sessionA)).toBe(true);
    expect(registers.some(r => r.year === sessionB)).toBe(true);
  });

  it('G11.5 mark and register share the same session (coherence)', async () => {
    const res = await post({ date: inSessionB, period: 4, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'late', lateMinutes: 5 }] });
    expect(res.status).toBe(200);

    const [mark] = await db
      .select({ year: attendance.academicYearId, registerId: attendance.registerId })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, STUDENT), eq(attendance.period, 4)));
    const [register] = await db
      .select({ year: attendanceRegisters.sessionYearId })
      .from(attendanceRegisters)
      .where(eq(attendanceRegisters.id, mark!.registerId!));

    expect(mark!.year).toBe(sessionB);
    expect(register!.year).toBe(mark!.year);
  });

  it('G11.6 a date outside every session is rejected with DATE_OUTSIDE_SESSION', async () => {
    const res = await post({ date: outside, period: 5, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('DATE_OUTSIDE_SESSION');
  });

  it('G11.7 a tenant with no sessions is rejected with MISSING_SESSION', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({ userId: `USR-ASY-E-${suffix}`, tenantId: emptyTenantId, role: 'school_admin', branchId: null } as RequestContext);

    const res = await post({ date: inSessionB, period: 1, studentGroupId: crypto.randomUUID(), records: [{ studentId: crypto.randomUUID(), status: 'present' }] });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('MISSING_SESSION');
    await asAdmin();
  });

  it('G11.8 legacy null-session registers are never treated as current', async () => {
    await db.insert(attendanceRegisters).values({
      tenantId, classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionId)))[0]!.classId,
      classSectionId: sectionId, sessionYearId: null, date: inSessionB, period: 6, reference: `REG-LEGACY-${suffix}`, status: 'LOCKED',
    });

    const res = await post({ date: inSessionB, period: 6, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });
    expect(res.status).toBe(200);

    const registers = await db
      .select({ id: attendanceRegisters.id, year: attendanceRegisters.sessionYearId })
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.date, inSessionB), eq(attendanceRegisters.period, 6)));

    expect(registers.some(r => r.year === null)).toBe(true); // legacy untouched
    expect(registers.some(r => r.year === sessionB)).toBe(true); // new current-session register
  });
});
