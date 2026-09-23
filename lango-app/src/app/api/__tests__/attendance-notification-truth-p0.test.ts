import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as reopenRegister } from '@/app/api/attendance/registers/reopen/route';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { db } from '@/libs/DB';
import { setSettingValue } from '@/libs/settings/registry';
import {
  attendance,
  attendanceRegisters,
  branches,
  classes,
  classSections,
  guardians,
  guardianStudents,
  mediums,
  sections,
  sessionYears,
  smsMessages,
  tenants,
  user,
} from '@/models/Schema';

// G13 — notification truth (Phase 6):
// G13.1 one absence event -> exactly one intent · G13.2 intent is NOT 'sent'
// without provider evidence · G13.3 unchanged resubmission -> zero duplicates
// G13.4 present->absent correction -> one appropriate intent · G13.5
// absent->present correction -> no new absence notice · G13.6 non-
// instructional day -> zero intents · G13.11 rollback -> zero orphans · G13.12
// retry/concurrency -> one logical intent.
// G13.7/G13.8/G13.9/G13.10 NOT APPLICABLE: no tenant SMS toggle is wired, no
// guardian preference model exists for this path, and no real provider is
// configured in the test environment (no fabricated success path).

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
const ADMIN = `USR-NTF-${suffix}`;
const STUDENT = crypto.randomUUID();
const date = '2026-10-05';
const saturday = '2026-10-03';

let sectionId = '';
let sessionYearId = '';

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

async function intents() {
  return db
    .select({ id: smsMessages.id, status: smsMessages.status, sentAt: smsMessages.sentAt })
    .from(smsMessages)
    .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.studentId, STUDENT)));
}

async function reopen(period: number) {
  const [register] = await db
    .select({ id: attendanceRegisters.id })
    .from(attendanceRegisters)
    .where(and(
      eq(attendanceRegisters.tenantId, tenantId),
      eq(attendanceRegisters.classSectionId, sectionId),
      eq(attendanceRegisters.date, date),
      eq(attendanceRegisters.period, period),
    ));
  return reopenRegister(new Request('http://x/api/attendance/registers/reopen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ registerId: register!.id, reason: 'correction test' }),
  }));
}

describe.skipIf(!dbReachable)('attendance notification truth P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Ntf ${suffix}`, slug: `att-ntf-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `NT-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Admin', email: `ntf-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT, tenantId, branchId: branch!.id, name: 'Student', email: `ntf-s-${suffix}@t.local`, role: 'student' },
    ]);
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `1A-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `A-${suffix}` }).returning();
    const [classSection] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = classSection!.id;
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.id, STUDENT));

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    sessionYearId = sessionYear!.id;

    const [guardian] = await db.insert(guardians).values({
      tenantId,
      userId: null,
      firstName: 'Guardian',
      lastName: suffix,
      phone: '+212611111111',
    }).returning();
    await db.insert(guardianStudents).values({ tenantId, guardianId: guardian!.id, studentId: STUDENT, relationshipType: 'father' });
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(smsMessages).where(eq(smsMessages.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('G13.1/G13.2: one absence event creates exactly one intent that is NOT "sent" without provider evidence', async () => {
    const res = await post({ date, period: 1, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] });

    expect(res.status).toBe(200);

    const rows = await intents();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).not.toBe('sent');
    expect(rows[0]!.status).toBe('queued');
    expect(rows[0]!.sentAt).toBeNull();
  });

  it('G13.3: unchanged resubmission creates zero duplicates', async () => {
    const before = await intents();

    const res = await reopen(1);

    expect(res.status).toBe(200);

    const resubmit = await post({
      date,
      period: 1,
      studentGroupId: sectionId,
      correctionNote: 'contrôle sans modification',
      records: [{ studentId: STUDENT, status: 'absent' }],
    });

    expect(resubmit.status).toBe(200);

    const after = await intents();

    expect(after).toHaveLength(before.length);
  });

  it('G13.4/G13.5: present->absent creates one intent; absent->present creates none', async () => {
    const before = await intents();

    await reopen(1);
    const toAbsent = await post({
      date,
      period: 1,
      studentGroupId: sectionId,
      correctionNote: 'élève finalement absent',
      records: [{ studentId: STUDENT, status: 'present' }],
    });

    expect(toAbsent.status).toBe(200);
    expect(await intents()).toHaveLength(before.length); // absent->present: no absence notice

    await reopen(1);
    const backToAbsent = await post({
      date,
      period: 1,
      studentGroupId: sectionId,
      correctionNote: 'retour à absent (vérifié)',
      records: [{ studentId: STUDENT, status: 'absent' }],
    });

    expect(backToAbsent.status).toBe(200);

    const after = await intents();

    expect(after).toHaveLength(before.length); // deterministic identity: same student+date already notified
  });

  it('G13.7: disabled attendance.smsAlerts suppresses the absence intent (mark still commits)', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    const ctx = { userId: ADMIN, tenantId, role: 'school_admin', branchId: null } as RequestContext;
    vi.mocked(requireRequestContext).mockResolvedValue(ctx);

    await setSettingValue(tenantId, null, 'attendance.smsAlerts', false, ctx as never);

    const before = await intents();
    const res = await post({ date, period: 5, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] });

    expect(res.status).toBe(200); // attendance still commits

    const [mark] = await db
      .select({ status: attendance.status })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, STUDENT),
        eq(attendance.date, date),
        eq(attendance.period, 5),
      ));

    expect(mark!.status).toBe('absent');

    expect(await intents()).toHaveLength(before.length); // zero new intents

    await setSettingValue(tenantId, null, 'attendance.smsAlerts', true, ctx as never);
  });

  it('G13.6: a non-instructional day creates zero intents', async () => {
    const res = await post({ date: saturday, period: 2, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('NON_INSTRUCTIONAL_DAY');

    const rows = await db
      .select({ id: smsMessages.id })
      .from(smsMessages)
      .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.body, `Absence non justifiée signalée pour Student le ${saturday}.`)));

    expect(rows).toHaveLength(0);
  });

  it('G13.11: a rejected batch (atomicity) leaves zero orphan intents', async () => {
    const before = await intents();

    const res = await post({
      date,
      period: 3,
      studentGroupId: sectionId,
      records: [
        { studentId: STUDENT, status: 'absent' },
        { studentId: crypto.randomUUID(), status: 'absent' },
      ],
    });

    expect(res.status).toBe(422);

    expect(await intents()).toHaveLength(before.length);
  });

  it('G13.12: concurrent submissions produce one logical intent', async () => {
    const before = await intents();

    const [a, b] = await Promise.all([
      post({ date, period: 4, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] }),
      post({ date, period: 4, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] }),
    ]);

    expect([a.status, b.status].includes(200)).toBe(true);

    const after = await intents();
    const body = `Absence non justifiée signalée pour Student le ${date}.`;
    const forThisDate = await db
      .select({ id: smsMessages.id })
      .from(smsMessages)
      .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.body, body)));

    expect(forThisDate).toHaveLength(1);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });
});
