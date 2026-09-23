import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as reopenRegister } from '@/app/api/attendance/registers/reopen/route';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { db } from '@/libs/DB';
import {
  attendance,
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

// P0 DB-backed lifecycle suite:
//   G5 register lock + reopen/correction · G6 uniqueness & concurrency
//   G16 batch atomicity · lock-bypass elimination · history preservation

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
const ADMIN = `USR-ATL-${suffix}`;
const STUDENT_1 = crypto.randomUUID();
const STUDENT_2 = crypto.randomUUID();
const STUDENT_ELSEWHERE = crypto.randomUUID();
const date = '2026-10-06';

let sectionId = '';
let otherSectionId = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId: ADMIN, tenantId, role: 'school_admin', branchId: null } as RequestContext);
}

function post(body: unknown): Promise<Response> {
  return postAttendance(new Request('http://x/api/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

async function activeMarks(studentId: string, period: number) {
  return db
    .select({ id: attendance.id, status: attendance.status, lateMinutes: attendance.lateMinutes, note: attendance.note })
    .from(attendance)
    .where(and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.studentId, studentId),
      eq(attendance.date, date),
      eq(attendance.period, period),
      eq(attendance.classSectionId, sectionId),
      eq(attendance.isVoided, false),
    ));
}

describe.skipIf(!dbReachable)('attendance lifecycle P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Life ${suffix}`, slug: `att-life-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `AL-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Admin', email: `atl-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT_1, tenantId, branchId: branch!.id, name: 'Student 1', email: `atl-s1-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_2, tenantId, branchId: branch!.id, name: 'Student 2', email: `atl-s2-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_ELSEWHERE, tenantId, branchId: branch!.id, name: 'Student X', email: `atl-sx-${suffix}@t.local`, role: 'student' },
    ]);
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
    sectionId = csRows[0]!.id;
    otherSectionId = csRows[1]!.id;

    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.id, STUDENT_1));
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.id, STUDENT_2));
    await db.update(user).set({ classSectionId: otherSectionId }).where(eq(user.id, STUDENT_ELSEWHERE));

    await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    });
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
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

  it('refuses a forged/unknown section instead of downgrading to an unlocked write', async () => {
    const res = await post({
      date,
      period: 1,
      studentGroupId: crypto.randomUUID(),
      records: [{ studentId: STUDENT_1, status: 'present' }],
    });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('INVALID_REFERENCE');
    expect(await activeMarks(STUDENT_1, 1)).toHaveLength(0);

    const registers = await db.select().from(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));

    expect(registers).toHaveLength(0);
  });

  it('refuses the whole batch when any student is unknown (atomicity)', async () => {
    const res = await post({
      date,
      period: 2,
      studentGroupId: sectionId,
      records: [
        { studentId: STUDENT_1, status: 'present' },
        { studentId: crypto.randomUUID(), status: 'absent' },
      ],
    });

    expect(res.status).toBe(422);
    expect(await activeMarks(STUDENT_1, 2)).toHaveLength(0);
    expect(await activeMarks(STUDENT_2, 2)).toHaveLength(0);
  });

  it('refuses the whole batch when a student is not placed in the target section', async () => {
    const res = await post({
      date,
      period: 3,
      studentGroupId: sectionId,
      records: [
        { studentId: STUDENT_1, status: 'present' },
        { studentId: STUDENT_ELSEWHERE, status: 'present' },
      ],
    });

    expect(res.status).toBe(403);
    expect(await activeMarks(STUDENT_1, 3)).toHaveLength(0);
  });

  it('locks the register on first submission and refuses a second locked submission', async () => {
    const first = await post({
      date,
      period: 4,
      studentGroupId: sectionId,
      records: [
        { studentId: STUDENT_1, status: 'present' },
        { studentId: STUDENT_2, status: 'absent' },
      ],
    });

    expect(first.status).toBe(200);

    const [register] = await db
      .select()
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.period, 4)));

    expect(register!.status).toBe('LOCKED');

    const second = await post({
      date,
      period: 4,
      studentGroupId: sectionId,
      records: [{ studentId: STUDENT_1, status: 'absent' }],
    });

    expect(second.status).toBe(409);
    expect((await bodyOf(second)).error.code).toBe('REGISTER_LOCKED');

    const marks = await activeMarks(STUDENT_1, 4);

    expect(marks).toHaveLength(1);
    expect(marks[0]!.status).toBe('present');
  });

  it('correction requires reopen + note and updates the mark in place with audit before/after', async () => {
    const [register] = await db
      .select()
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.period, 4)));

    const reopen = await reopenRegister(new Request('http://x/api/attendance/registers/reopen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ registerId: register!.id, reason: 'Erreur de saisie' }),
    }));

    expect(reopen.status).toBe(200);

    const noNote = await post({
      date,
      period: 4,
      studentGroupId: sectionId,
      records: [{ studentId: STUDENT_1, status: 'absent' }],
    });

    expect(noNote.status).toBe(400);
    expect((await bodyOf(noNote)).error.code).toBe('CORRECTION_NOTE_REQUIRED');

    const before = await activeMarks(STUDENT_1, 4);

    const corrected = await post({
      date,
      period: 4,
      studentGroupId: sectionId,
      correctionNote: 'Élève finalement absent (vérifié avec le parent)',
      records: [{ studentId: STUDENT_1, status: 'absent' }],
    });

    expect(corrected.status).toBe(200);

    const after = await activeMarks(STUDENT_1, 4);

    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.status).toBe('absent');

    const { recordAudit } = await import('@/libs/api/audit');
    const auditCalls = vi.mocked(recordAudit).mock.calls.filter(call => call[2] === 'attendance' && (call[4] as any)?.before);

    expect(auditCalls.length).toBeGreaterThanOrEqual(1);

    const lastCall = auditCalls[auditCalls.length - 1]!;

    expect((lastCall[4] as any).before.status).toBe('present');
    expect((lastCall[4] as any).after.status).toBe('absent');
  });

  it('re-submitting identical marks after reopen keeps the same row (no churn, no duplicate)', async () => {
    const [register] = await db
      .select()
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.period, 4)));

    await reopenRegister(new Request('http://x/api/attendance/registers/reopen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ registerId: register!.id, reason: 'Contrôle' }),
    }));

    const before = await activeMarks(STUDENT_2, 4);

    const res = await post({
      date,
      period: 4,
      studentGroupId: sectionId,
      correctionNote: 'Contrôle sans modification',
      records: [{ studentId: STUDENT_2, status: 'absent' }],
    });

    expect(res.status).toBe(200);

    const after = await activeMarks(STUDENT_2, 4);

    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before[0]!.id);
  });

  it('concurrent submissions produce one register and one active mark (G17)', async () => {
    const [first, second] = await Promise.all([
      post({
        date,
        period: 5,
        studentGroupId: sectionId,
        records: [{ studentId: STUDENT_1, status: 'present' }],
      }),
      post({
        date,
        period: 5,
        studentGroupId: sectionId,
        records: [{ studentId: STUDENT_1, status: 'late', lateMinutes: 10 }],
      }),
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).toContain(200);
    expect(statuses.every(status => status === 200 || status === 409)).toBe(true);

    const registers = await db
      .select()
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classSectionId, sectionId), eq(attendanceRegisters.period, 5)));

    expect(registers).toHaveLength(1);

    const marks = await activeMarks(STUDENT_1, 5);

    expect(marks).toHaveLength(1);
  });

  it('database-level uniqueness rejects a duplicate active mark', async () => {
    await post({
      date,
      period: 6,
      studentGroupId: sectionId,
      records: [{ studentId: STUDENT_1, status: 'present' }],
    });

    await expect(db.insert(attendance).values({
      tenantId,
      studentId: STUDENT_1,
      studentGroupId: sectionId,
      classSectionId: sectionId,
      period: 6,
      date,
      status: 'absent',
      isVoided: false,
    })).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
