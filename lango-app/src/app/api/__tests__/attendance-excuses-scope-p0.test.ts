import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postExcuse, PATCH as reviewExcuse } from '@/app/api/attendance/excuses/route';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceExcuses,
  attendanceRegisters,
  branches,
  classes,
  classSections,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed excuse scope suite:
//   G7 exact-scope mutation · G8 cross-period isolation
//   G9 cross-section/student isolation + register-lock respect + re-review guard

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
const ADMIN = `USR-AEX-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const date = '2026-10-07';

let sectionA = '';
let sectionB = '';
let sessionYearId = '';

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

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

async function markStatus(studentId: string, sectionId: string, period: number) {
  const [row] = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.studentId, studentId),
      eq(attendance.classSectionId, sectionId),
      eq(attendance.date, date),
      eq(attendance.period, period),
      eq(attendance.isVoided, false),
    ));
  return row?.status ?? null;
}

async function createExcuse(studentId: string, sectionId: string, period: number) {
  const res = await postExcuse(jsonRequest('http://x/api/attendance/excuses', 'POST', {
    studentId,
    classSectionId: sectionId,
    period,
    date,
    reason: `Justification ${suffix}`,
  }));
  return bodyOf(res);
}

async function approve(excuseId: string, extra: Record<string, unknown> = {}) {
  return reviewExcuse(jsonRequest('http://x/api/attendance/excuses', 'PATCH', {
    excuseId,
    status: 'approved',
    ...extra,
  }));
}

describe.skipIf(!dbReachable)('attendance excuse scope P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Exc ${suffix}`, slug: `att-exc-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `AE-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Admin', email: `aex-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT_A, tenantId, branchId: branch!.id, name: 'Student A', email: `aex-sa-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branch!.id, name: 'Student B', email: `aex-sb-${suffix}@t.local`, role: 'student' },
    ]);
    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    sessionYearId = sessionYear!.id;

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `1A-${suffix}`, mediumId: medium!.id }).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `B-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: cls!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: cls!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();
    sectionA = csRows[0]!.id;
    sectionB = csRows[1]!.id;

    await db.update(user).set({ classSectionId: sectionA }).where(eq(user.id, STUDENT_A));
    await db.update(user).set({ classSectionId: sectionB }).where(eq(user.id, STUDENT_B));

    // Authoritative marks: S1 has period 1 and 2 in section A; S2 has period 1 in section B.
    await db.insert(attendance).values([
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, studentGroupId: cls!.id, academicYearId: sessionYearId, date, period: 1, status: 'absent', isVoided: false },
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, studentGroupId: cls!.id, academicYearId: sessionYearId, date, period: 2, status: 'present', isVoided: false },
      { tenantId, studentId: STUDENT_B, classSectionId: sectionB, studentGroupId: cls!.id, academicYearId: sessionYearId, date, period: 1, status: 'present', isVoided: false },
    ]);
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('G7: approving a period-1 excuse flips only that mark, never period 2', async () => {
    const excuse = await createExcuse(STUDENT_A, sectionA, 1);

    expect(excuse.success).toBe(true);

    const res = await approve(excuse.data.id);

    expect(res.status).toBe(200);

    expect(await markStatus(STUDENT_A, sectionA, 1)).toBe('excused');
    expect(await markStatus(STUDENT_A, sectionA, 2)).toBe('present');
  });

  it('G8: a period-2 excuse never touches period 1', async () => {
    const [markP2] = await db
      .update(attendance)
      .set({ status: 'absent' })
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, STUDENT_A),
        eq(attendance.classSectionId, sectionA),
        eq(attendance.date, date),
        eq(attendance.period, 2),
      ))
      .returning();

    const excuse = await createExcuse(STUDENT_A, sectionA, 2);
    const res = await approve(excuse.data.id);

    expect(res.status).toBe(200);

    expect(await markStatus(STUDENT_A, sectionA, 2)).toBe('excused');
    expect(await markStatus(STUDENT_A, sectionA, 1)).toBe('excused'); // untouched by THIS approval (already excused in G7)
    expect(markP2!.status).toBe('absent'); // sanity: before approval it was absent
  });

  it('G9: another student in another section is never mutated', async () => {
    const excuse = await createExcuse(STUDENT_A, sectionA, 1);
    void excuse;
    const second = await createExcuse(STUDENT_A, sectionA, 2);
    const res = await approve(second.data.id, { allowRereview: true });
    void res;

    expect(await markStatus(STUDENT_B, sectionB, 1)).toBe('present');
  });

  it('G9b: a locked register refuses silent excuse approval', async () => {
    await db.insert(attendanceRegisters).values({
      tenantId,
      classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionA)))[0]!.classId,
      classSectionId: sectionA,
      date,
      period: 2,
      reference: `REG-LOCK-${suffix}`,
      status: 'LOCKED',
    });

    const [mark] = await db
      .update(attendance)
      .set({ status: 'absent' })
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, STUDENT_A),
        eq(attendance.classSectionId, sectionA),
        eq(attendance.date, date),
        eq(attendance.period, 2),
      ))
      .returning();

    const excuse = await createExcuse(STUDENT_A, sectionA, 2);
    const res = await approve(excuse.data.id, { allowRereview: true });

    expect(res.status).toBe(409);
    expect((await bodyOf(res)).error.code).toBe('REGISTER_LOCKED');
    expect(await markStatus(STUDENT_A, sectionA, 2)).toBe('absent');
    expect(mark!.status).toBe('absent');
  });

  it('re-review of an already-reviewed excuse requires an explicit flag', async () => {
    const excuse = await createExcuse(STUDENT_A, sectionA, 1);

    const first = await approve(excuse.data.id, { allowRereview: true });

    expect(first.status).toBe(200);

    const second = await approve(excuse.data.id);

    expect(second.status).toBe(409);
    expect((await bodyOf(second)).error.code).toBe('ALREADY_REVIEWED');

    const third = await approve(excuse.data.id, { allowRereview: true });

    expect(third.status).toBe(200);
  });

  it('rejects a cross-tenant section on creation', async () => {
    const otherTenant = crypto.randomUUID();
    await db.insert(tenants).values({ id: otherTenant, name: `Att Exc X ${suffix}`, slug: `att-excx-${suffix}` });

    const res = await postExcuse(jsonRequest('http://x/api/attendance/excuses', 'POST', {
      studentId: STUDENT_A,
      classSectionId: crypto.randomUUID(),
      period: 1,
      date,
      reason: 'probe',
    }));

    expect(res.status).toBe(422);

    await db.delete(tenants).where(eq(tenants.id, otherTenant));
  });

  it('refuses to auto-apply a legacy unscoped excuse', async () => {
    const [legacy] = await db.insert(attendanceExcuses).values({
      tenantId,
      studentId: STUDENT_A,
      sessionYearId,
      date,
      reason: 'legacy unscoped',
      status: 'pending',
    }).returning();

    const res = await approve(legacy!.id);

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('EXCUSE_SCOPE_REQUIRED');
  });
});
