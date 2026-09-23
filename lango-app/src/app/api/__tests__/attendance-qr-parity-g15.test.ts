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
  classSections,
  identityBadgeCredentials,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// G15 QR ATTENDANCE PARITY — DB-backed: QR writes must go through the same
// canonical validation/mutation rules as POST /api/attendance (tenant, campus,
// section, session, instructional day, register lock, active-mark uniqueness,
// audit, summary/flag side effects) — no weaker parallel path.

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

async function activeMarksFor(p: Provisioned, studentId: string) {
  return db
    .select()
    .from(attendance)
    .where(and(
      eq(attendance.tenantId, p.tenantId),
      eq(attendance.studentId, studentId),
      eq(attendance.date, TODAY),
      eq(attendance.isVoided, false),
    ));
}

describe.skipIf(!dbReachable)('G15 QR attendance parity — DB-backed', () => {
  let main: Provisioned;
  let wrongTenant: Provisioned;
  let oldSession: Provisioned;
  let noSession: Provisioned;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);
    main = await provision('qr-main', { session: 'current' });
    wrongTenant = await provision('qr-wrong', { session: 'current' });
    oldSession = await provision('qr-old', { session: 'old' });
    noSession = await provision('qr-none', { session: 'none' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    const ids = [main, wrongTenant, oldSession, noSession].filter(Boolean);
    for (const p of ids) {
      await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, p.tenantId));
      await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, p.tenantId));
      await db.delete(attendance).where(eq(attendance.tenantId, p.tenantId));
      await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, p.tenantId));
      await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, p.tenantId));
      await db.delete(sessionYears).where(eq(sessionYears.tenantId, p.tenantId));
      await db.delete(user).where(eq(user.tenantId, p.tenantId));
      await db.delete(classSections).where(eq(classSections.tenantId, p.tenantId));
      await db.delete(classes).where(eq(classes.tenantId, p.tenantId));
      await db.delete(sections).where(eq(sections.tenantId, p.tenantId));
      await db.delete(mediums).where(eq(mediums.tenantId, p.tenantId));
      await db.delete(branches).where(eq(branches.tenantId, p.tenantId));
      await db.delete(tenants).where(eq(tenants.id, p.tenantId));
    }
  });

  it('G15.1: a valid QR scan writes one canonical mark (session + section + period)', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, period: 1 });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('accepted');
    expect(json.data.stagedStatus).toBe('present'); // 07:30 < 08:00 + grace

    const marks = await activeMarksFor(main, main.studentA);

    expect(marks).toHaveLength(1);
    expect(marks[0]!.status).toBe('present');
    expect(marks[0]!.academicYearId).toBe(main.sessionYearId);
    expect(marks[0]!.classSectionId).toBe(main.sectionId);
    expect(marks[0]!.period).toBe(1);
    expect(marks[0]!.scanEventId).not.toBeNull();
  });

  it('G15.2: duplicate scan does not duplicate the active mark', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, period: 1 });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('already_scanned');

    const marks = await activeMarksFor(main, main.studentA);

    expect(marks).toHaveLength(1); // still exactly one active mark

    const events = await db
      .select({ resultStatus: attendanceScanEvents.resultStatus })
      .from(attendanceScanEvents)
      .where(and(eq(attendanceScanEvents.tenantId, main.tenantId), eq(attendanceScanEvents.studentId, main.studentA)));

    expect(events.filter(e => e.resultStatus === 'accepted')).toHaveLength(1);
    expect(events.filter(e => e.resultStatus === 'already_scanned')).toHaveLength(1);
  });

  it('G15.3: a badge from another tenant is rejected (no cross-tenant write)', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: wrongTenant.tokenA, classSectionId: main.sectionId, period: 1 });

    expect(res.status).toBe(404);

    const marks = await activeMarksFor(main, wrongTenant.studentA);

    expect(marks).toHaveLength(0);
  });

  it('G15.4: a student from another section is rejected', async () => {
    await asTenant(main);
    const res = await scan({ rawToken: main.tokenB, classSectionId: main.sectionId, period: 1 });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('WRONG_CLASS');

    const marks = await activeMarksFor(main, main.studentB);

    expect(marks).toHaveLength(0);
  });

  it('G15.5: a date outside every academic session is rejected (old session only)', async () => {
    await asTenant(oldSession);
    const res = await scan({ rawToken: oldSession.tokenA, classSectionId: oldSession.sectionId, period: 1 });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('DATE_OUTSIDE_SESSION');

    const marks = await activeMarksFor(oldSession, oldSession.studentA);

    expect(marks).toHaveLength(0);
  });

  it('G15.6: missing canonical session context fails closed (no session configured)', async () => {
    await asTenant(noSession);
    const res = await scan({ rawToken: noSession.tokenA, classSectionId: noSession.sectionId, period: 1 });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('DATE_OUTSIDE_SESSION');

    const marks = await activeMarksFor(noSession, noSession.studentA);

    expect(marks).toHaveLength(0);
  });

  it('G15.7: a locked register rejects the scan', async () => {
    await asTenant(main);
    await db.insert(attendanceRegisters).values({
      tenantId: main.tenantId,
      classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, main.sectionId)).limit(1))[0]!.classId,
      classSectionId: main.sectionId,
      sessionYearId: main.sessionYearId,
      date: TODAY,
      period: 2,
      reference: `REG-G15-${suffix}-P2`,
      status: 'LOCKED',
      submittedAt: new Date().toISOString(),
      submittedById: main.adminId,
    });
    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, period: 2 });

    expect(res.status).toBe(409);

    const marks = await db
      .select()
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, main.tenantId),
        eq(attendance.studentId, main.studentA),
        eq(attendance.period, 2),
      ));

    expect(marks).toHaveLength(0);
  });

  it('G15.8: a caller without attendance.manage is rejected', async () => {
    await asTenant(main);
    permissionState.allowed = false;
    try {
      const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, period: 4 });

      expect(res.status).toBe(403);
    } finally {
      permissionState.allowed = true;
    }
    const marks = await db
      .select()
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, main.tenantId),
        eq(attendance.studentId, main.studentA),
        eq(attendance.period, 4),
      ));

    expect(marks).toHaveLength(0);
  });

  it('G15.9: a scan over an existing manual mark is an in-place correction with audit', async () => {
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

    const res = await scan({ rawToken: main.tokenA, classSectionId: main.sectionId, period: 3 });

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, main.tenantId),
        eq(attendance.studentId, main.studentA),
        eq(attendance.period, 3),
      ));

    expect(rows).toHaveLength(1); // same mark, updated in place — nothing duplicated
    expect(rows[0]!.id).toBe(manual!.id);
    expect(rows[0]!.status).toBe('present');
    expect(rows[0]!.scanEventId).not.toBeNull();

    // recordAudit(context, 'update', 'attendance', id, payload)
    const correction = auditCalls.find(call => call[1] === 'update' && call[2] === 'attendance' && call[3] === manual!.id);

    expect(correction).toBeTruthy();
    expect((correction![4] as any).reason).toBe('qr_scan_correction');
  });

  it('G15.10: QR marks appear identically in the canonical aggregate and summary cache', async () => {
    await asTenant(main);
    const aggregate = await getAttendanceAggregate({
      tenantId: main.tenantId,
      sessionYearId: main.sessionYearId!,
      studentId: main.studentA,
      classSectionId: main.sectionId,
    });

    // Periods 1 and 3 are present (period 3 corrected by scan).
    expect(aggregate.presentCount).toBe(2);
    expect(aggregate.recordedTotal).toBe(2);
    expect(aggregate.presenceRate).toBe(100);

    const [cache] = await db
      .select()
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, main.tenantId), eq(attendanceSummary.studentId, main.studentA)));

    expect(cache).toBeTruthy();
    expect(cache!.totalPresent).toBe(aggregate.presentCount);
    expect(cache!.totalSessions).toBe(aggregate.recordedTotal);
    expect(Number(cache!.attendanceRate)).toBe(aggregate.presenceRate);
  });
});
