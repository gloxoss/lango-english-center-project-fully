import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as verifyAndStage } from '@/app/api/attendance/qr/verify-and-stage/route';
import { getAttendanceAggregate } from '@/libs/api/attendance-aggregate';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceRegisters,
  attendanceScanEvents,
  attendanceSummary,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  identityBadgeCredentials,
  mediums,
  scannerSessions,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// G15 QR ATTENDANCE PARITY — DB-backed: a QR scan must go through the same
// canonical validation as POST /api/attendance (tenant, campus, section,
// academic session, instructional day, register lock) — no weaker parallel path.
//
// It no longer WRITES a mark (fix-plan-02): the accepted scan event is the whole
// output and the teacher's submission is what marks the register. So parity here
// reads "the same gates were enforced, and no attendance row appeared".

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

const permissionState = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/libs/api/permissions', async () => {
  const { ApiError } = await import('@/libs/api/errors');
  return {
    requireCapability: vi.fn(async () => {
      if (!permissionState.allowed) {
        throw new ApiError(403, 'FORBIDDEN', 'Capability refusée.');
      }
    }),
  };
});

const auditCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn((...args: unknown[]) => {
    auditCalls.push(args);
  }),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const FROZEN_NOW = new Date('2026-10-06T06:30:00.000Z'); // 07:30 Casablanca — Tuesday
const TODAY = '2026-10-06';

type Provisioned = {
  tenantId: string;
  adminId: string;
  sectionId: string;
  otherSectionId: string;
  sessionYearId: string | null;
  studentA: string;
  studentB: string;
  tokenA: string;
  tokenB: string;
};

async function provision(name: string, opts: { session?: 'current' | 'old' | 'none' } = {}): Promise<Provisioned> {
  const tenantId = crypto.randomUUID();
  const adminId = `QR-ADMIN-${tenantId}`;
  const studentA = crypto.randomUUID();
  const studentB = crypto.randomUUID();
  const tokenA = `tok-a-${crypto.randomUUID()}`;
  const tokenB = `tok-b-${crypto.randomUUID()}`;

  await db.insert(tenants).values({ id: tenantId, name: `${name}-${suffix}`, slug: `${name}-${suffix}` });
  const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `QR-${suffix}-${tenantId.slice(0, 4)}` }).returning();
  await db.insert(user).values([
    { id: adminId, tenantId, branchId: branch!.id, name: 'QR Admin', email: `${adminId}@t.local`, role: 'school_admin' },
    { id: studentA, tenantId, branchId: branch!.id, name: 'QR Student A', email: `qa-${studentA}@t.local`, role: 'student' },
    { id: studentB, tenantId, branchId: branch!.id, name: 'QR Student B', email: `qb-${studentB}@t.local`, role: 'student' },
  ]);
  const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
  const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `QR1-${suffix}`, mediumId: medium!.id }).returning();
  const labels = await db.insert(sections).values([
    { tenantId, name: `A-${suffix}` },
    { tenantId, name: `B-${suffix}` },
  ]).returning();
  const csRows = await db.insert(classSections).values([
    { tenantId, classId: cls!.id, sectionId: labels[0]!.id, mediumId: medium!.id, maxStudents: 30 },
    { tenantId, classId: cls!.id, sectionId: labels[1]!.id, mediumId: medium!.id, maxStudents: 30 },
  ]).returning();
  await db.update(user).set({ classSectionId: csRows[0]!.id }).where(eq(user.id, studentA));
  await db.update(user).set({ classSectionId: csRows[1]!.id }).where(eq(user.id, studentB));

  let sessionYearId: string | null = null;
  if (opts.session !== 'none') {
    const [session] = await db.insert(sessionYears).values({
      tenantId,
      name: opts.session === 'old' ? `2025-2026-${suffix}` : `2026-2027-${suffix}`,
      startDate: opts.session === 'old' ? '2025-09-01' : '2026-09-01',
      endDate: opts.session === 'old' ? '2026-06-30' : '2027-06-30',
      isDefault: opts.session !== 'old',
    }).returning();
    sessionYearId = session!.id;
  }

  await db.insert(identityBadgeCredentials).values([
    { tenantId, userId: studentA, tokenHash: computeHmacHash(tokenA), status: 'active' },
    { tenantId, userId: studentB, tokenHash: computeHmacHash(tokenB), status: 'active' },
  ]);

  // A timetable for both sections, so a scan made inside a running lesson has
  // one to resolve. It starts at the frozen clock (07:30 Casablanca) so the
  // parity cases assert an on-time stage without depending on lateness maths,
  // and so the register-lock case has a period to lock.
  if (sessionYearId) {
    const [subject] = await db.insert(subjects).values({ tenantId, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();
    const [version] = await db.insert(timetableVersions).values({
      tenantId,
      sessionYearId,
      status: 'published',
      versionNumber: 1,
      // A version that does not cover today (the 'old' session) resolves to no
      // occurrence at all, which is the point of that fixture.
      effectiveFrom: opts.session === 'old' ? '2025-09-01' : '2026-09-01',
      effectiveTo: opts.session === 'old' ? '2026-06-30' : '2027-06-30',
      createdBy: adminId,
    }).returning();

    // Section A only: one teacher cannot hold two overlapping lessons, and the
    // parity cases scan section A. A scan for section B finds no lesson and is
    // an arrival only, which is the entrance behaviour either way.
    await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId: csRows[0]!.id,
      classSubjectId: classSubject!.id,
      teacherId: adminId,
      dayOfWeek: 'tuesday' as const,
      startTime: '07:30',
      endTime: '08:25',
      versionId: version!.id,
    });
  }

  return { tenantId, adminId, sectionId: csRows[0]!.id, otherSectionId: csRows[1]!.id, sessionYearId, studentA, studentB, tokenA, tokenB };
}

async function asTenant(p: Provisioned) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: p.adminId,
    tenantId: p.tenantId,
    role: 'school_admin',
    branchId: null,
  } as RequestContext);
}

function scan(body: unknown): Promise<Response> {
  return verifyAndStage(new Request('http://x/api/attendance/qr/verify-and-stage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function acceptedEventsFor(p: Provisioned, studentId: string) {
  return db
    .select()
    .from(attendanceScanEvents)
    .where(and(
      eq(attendanceScanEvents.tenantId, p.tenantId),
      eq(attendanceScanEvents.studentId, studentId),
      eq(attendanceScanEvents.resultStatus, 'accepted'),
    ));
}

/** Every mark of the tenant, voided or not: a scan writes none of them. */
async function attendanceRowsFor(p: Provisioned) {
  return db.select().from(attendance).where(eq(attendance.tenantId, p.tenantId));
}

async function removeTenant(p: Provisioned) {
  await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, p.tenantId));
  await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, p.tenantId));
  await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, p.tenantId));
  await db.delete(attendance).where(eq(attendance.tenantId, p.tenantId));
  await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, p.tenantId));
  await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, p.tenantId));
  await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, p.tenantId));
  await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, p.tenantId));
  await db.delete(classSubjects).where(eq(classSubjects.tenantId, p.tenantId));
  await db.delete(subjects).where(eq(subjects.tenantId, p.tenantId));
  await db.delete(sessionYears).where(eq(sessionYears.tenantId, p.tenantId));
  await db.delete(user).where(eq(user.tenantId, p.tenantId));
  await db.delete(classSections).where(eq(classSections.tenantId, p.tenantId));
  await db.delete(classes).where(eq(classes.tenantId, p.tenantId));
  await db.delete(sections).where(eq(sections.tenantId, p.tenantId));
  await db.delete(mediums).where(eq(mediums.tenantId, p.tenantId));
  await db.delete(branches).where(eq(branches.tenantId, p.tenantId));
  await db.delete(tenants).where(eq(tenants.id, p.tenantId));
}

describe.skipIf(!dbReachable)('G15 QR attendance parity — DB-backed', () => {
  let main: Provisioned;
  let wrongTenant: Provisioned;
  let oldSession: Provisioned;
  let noSession: Provisioned;
  // One duplicate rule survives: inside a scanner session, one accepted scan per
  // credential. Nothing outside a session can be duplicated any more, because
  // there is no mark to duplicate.
  let mainEntranceSessionId = '';

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);
    main = await provision('qr-main', { session: 'current' });
    wrongTenant = await provision('qr-wrong', { session: 'current' });
    oldSession = await provision('qr-old', { session: 'old' });
    noSession = await provision('qr-none', { session: 'none' });

    const [entrance] = await db.insert(scannerSessions).values({
      tenantId: main.tenantId,
      operatorId: main.adminId,
      classSectionId: null,
      classScheduleSlotId: null,
      date: TODAY,
      status: 'active',
    }).returning();

    mainEntranceSessionId = entrance!.id;
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const p of [main, wrongTenant, oldSession, noSession].filter(Boolean)) {
      await removeTenant(p);
    }
  });

  it('G15.1: a valid QR scan stages one scan event and writes no mark', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('accepted');
    // 07:30 is the lesson's own start, so with 15 min grace it is on time.
    expect(json.data.stagedStatus).toBe('present');
    expect(json.data.mode).toBe('entrance');
    expect(json.data.arrivalOnly).toBe(false); // the 07:30 lesson is running

    const events = await acceptedEventsFor(main, main.studentA);

    expect(events).toHaveLength(1);
    expect(events[0]!.classSectionId).toBe(main.sectionId);
    expect(events[0]!.stagedStatus).toBe('present');
    // NULL is how "staged, not yet validated" is represented.
    expect(events[0]!.attendanceRecordId).toBeNull();

    expect(await attendanceRowsFor(main)).toHaveLength(0);
  });

  it('G15.2: the same badge in the same session is already_scanned, not a second acceptance', async () => {
    await asTenant(main);
    const first = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, sessionId: mainEntranceSessionId });

    expect(first.status).toBe(200);
    expect((await first.json() as any).data.resultStatus).toBe('accepted');

    const second = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, sessionId: mainEntranceSessionId });

    expect(second.status).toBe(200);

    const json = await second.json() as any;

    expect(json.data.resultStatus).toBe('already_scanned');

    const events = await db
      .select({ resultStatus: attendanceScanEvents.resultStatus })
      .from(attendanceScanEvents)
      .where(and(
        eq(attendanceScanEvents.tenantId, main.tenantId),
        eq(attendanceScanEvents.sessionId, mainEntranceSessionId),
      ));

    expect(events.filter(e => e.resultStatus === 'accepted')).toHaveLength(1);
    expect(events.filter(e => e.resultStatus === 'already_scanned')).toHaveLength(1);
    expect(await attendanceRowsFor(main)).toHaveLength(0);
  });

  it('G15.3: a badge from another tenant is rejected (no cross-tenant write)', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: wrongTenant.tokenA, classSectionId: main.sectionId });

    expect(res.status).toBe(404);

    expect(await attendanceRowsFor(wrongTenant)).toHaveLength(0);
    expect(await attendanceRowsFor(main)).toHaveLength(0);
  });

  it('G15.4: an entrance scan accepts a student from another section', async () => {
    // The roster check is a CLASSROOM rule now (fix-plan-02): a portique has no
    // lesson for the student to belong to. WrongClass is covered where it still
    // means something, in attendance-qr-scan-modes.test.ts.
    await asTenant(main);
    const res = await scan({ rawToken: main.tokenB, classSectionId: main.sectionId });

    expect(res.status).toBe(200);
    expect((await res.json() as any).data.resultStatus).toBe('accepted');

    expect(await attendanceRowsFor(main)).toHaveLength(0);
  });

  it('G15.5: a date outside every academic session is rejected (old session only)', async () => {
    await asTenant(oldSession);
    const res = await scan({ rawToken: oldSession.tokenA, classSectionId: oldSession.sectionId });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('DATE_OUTSIDE_SESSION');

    expect(await attendanceRowsFor(oldSession)).toHaveLength(0);
  });

  it('G15.6: missing canonical session context fails closed (no session configured)', async () => {
    await asTenant(noSession);
    const res = await scan({ rawToken: noSession.tokenA, classSectionId: noSession.sectionId });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('DATE_OUTSIDE_SESSION');

    expect(await attendanceRowsFor(noSession)).toHaveLength(0);
  });

  it('G15.7: a locked register rejects the scan', async () => {
    await asTenant(main);
    // The scan resolves the 07:30 lesson, which is period 1 of the day.
    await db.insert(attendanceRegisters).values({
      tenantId: main.tenantId,
      classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, main.sectionId)).limit(1))[0]!.classId,
      classSectionId: main.sectionId,
      sessionYearId: main.sessionYearId,
      date: TODAY,
      period: 1,
      reference: `REG-G15-${suffix}-P1`,
      status: 'LOCKED',
      submittedAt: new Date().toISOString(),
      submittedById: main.adminId,
    });

    try {
      const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId });

      expect(res.status).toBe(409);
      expect((await res.json() as any).error.code).toBe('REGISTER_LOCKED');
      expect(await attendanceRowsFor(main)).toHaveLength(0);
    } finally {
      // The lock is this case's, not the rest of the file's.
      await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, main.tenantId));
    }
  });

  it('G15.8: a caller without attendance.manage is rejected', async () => {
    await asTenant(main);
    permissionState.allowed = false;
    try {
      const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId });

      expect(res.status).toBe(403);
    } finally {
      permissionState.allowed = true;
    }

    expect(await attendanceRowsFor(main)).toHaveLength(0);
  });

  it('G15.9: a scan leaves an existing manual mark exactly as the teacher wrote it', async () => {
    await asTenant(main);
    const [manual] = await db.insert(attendance).values({
      tenantId: main.tenantId,
      studentId: main.studentA,
      studentGroupId: null,
      classSectionId: main.sectionId,
      academicYearId: main.sessionYearId,
      period: 3,
      date: TODAY,
      status: 'absent',
      markedById: main.adminId,
      isVoided: false,
    }).returning();

    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId });

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, main.tenantId),
        eq(attendance.studentId, main.studentA),
        eq(attendance.period, 3),
      ));

    // Untouched: a scan stages, it never corrects the register.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(manual!.id);
    expect(rows[0]!.status).toBe('absent');
    expect(rows[0]!.scanEventId).toBeNull();

    // And nothing audited an attendance write, because none happened.
    const attendanceAudit = auditCalls.find(call => call[2] === 'attendance');

    expect(attendanceAudit).toBeUndefined();
  });

  it('G15.10: a scan leaves the canonical aggregate and the summary cache alone', async () => {
    await asTenant(main);
    const aggregate = await getAttendanceAggregate({
      tenantId: main.tenantId,
      sessionYearId: main.sessionYearId!,
      studentId: main.studentA,
      classSectionId: main.sectionId,
    });

    // The only mark in this tenant is the manual 'absent' one from G15.9; every
    // scan staged and contributed nothing.
    expect(aggregate.presentCount).toBe(0);
    expect(aggregate.absentCount).toBe(1);
    expect(aggregate.recordedTotal).toBe(1);

    const cache = await db
      .select()
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, main.tenantId), eq(attendanceSummary.studentId, main.studentA)));

    // The summary cache is written by a submission, never by a scan.
    expect(cache).toHaveLength(0);
  });
});

// A credential's status column cannot express expiry, so an "active" badge whose
// expiry date has passed must still be refused by the scanner. These fixtures
// live in their own tenant so they cannot disturb the parity cases above.
describe.skipIf(!dbReachable)('G15 badge expiry — DB-backed', () => {
  let p: Provisioned;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);
    p = await provision('qr-expiry', { session: 'current' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    if (p) {
      await removeTenant(p);
    }
  });

  async function setExpiry(studentId: string, expiresAt: string | null) {
    await db
      .update(identityBadgeCredentials)
      .set({ expiresAt })
      .where(and(
        eq(identityBadgeCredentials.tenantId, p.tenantId),
        eq(identityBadgeCredentials.userId, studentId),
      ));
  }

  it('G15.11: an active badge past its expiry is refused and writes no mark', async () => {
    await asTenant(p);
    await setExpiry(p.studentA, '2026-10-05T00:00:00.000Z'); // one day before FROZEN_NOW

    const res = await scan({ rawToken: p.tokenA, classSectionId: p.sectionId });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('BADGE_EXPIRED');
    expect(await attendanceRowsFor(p)).toHaveLength(0);
  });

  it('G15.12: the expiry refusal is recorded as a rejected scan event', async () => {
    const events = await db
      .select()
      .from(attendanceScanEvents)
      .where(and(
        eq(attendanceScanEvents.tenantId, p.tenantId),
        eq(attendanceScanEvents.rejectionReason, 'BADGE_EXPIRED'),
      ));

    expect(events).toHaveLength(1);
    expect(events[0]!.resultStatus).toBe('rejected');
    expect(events[0]!.studentId).toBe(p.studentA);
  });

  it('G15.13: an active badge whose expiry is still in the future is accepted', async () => {
    await asTenant(p);
    await setExpiry(p.studentA, '2026-11-01T00:00:00.000Z');

    const res = await scan({ rawToken: p.tokenA, classSectionId: p.sectionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('accepted');
    expect(await acceptedEventsFor(p, p.studentA)).toHaveLength(1);
    expect(await attendanceRowsFor(p)).toHaveLength(0);
  });

  it('G15.14: a badge with no expiry recorded is accepted', async () => {
    await asTenant(p);
    await setExpiry(p.studentB, null);

    const res = await scan({ rawToken: p.tokenB, classSectionId: p.otherSectionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('accepted');
    expect(await attendanceRowsFor(p)).toHaveLength(0);
  });
});
