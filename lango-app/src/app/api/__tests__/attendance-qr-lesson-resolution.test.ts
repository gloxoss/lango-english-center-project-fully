import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as verifyAndStage } from '@/app/api/attendance/qr/verify-and-stage/route';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceScanEvents,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSessionExceptions,
  classSubjects,
  identityBadgeCredentials,
  mediums,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// fix-plan-01 item 1. Every QR scan was written to PERIOD 1, because the client
// never sent a period and the schema defaulted it to 1. A 14:00 scan marked the
// 08:00 lesson — wrong data — and lateness was judged against 08:00, which undid
// the session-relative lateness fix as well.
//
// fix-plan-02 then made the scan stage instead of writing: the lesson below is
// what the scan REPORTS (and what its staged status is measured against), and no
// `attendance` row is written by either mode. These scans carry no scanner
// session, so they are entrance scans in which a lesson is informational only.
//
// Clock pinned at 14:10 Casablanca on a Tuesday.
const FROZEN_NOW = new Date('2026-10-06T13:10:00.000Z');
const TODAY = '2026-10-06';
// 12:30 Casablanca. The day is 08:00-11:55 then 14:00, and the register window
// tolerates end + 15 min, so the real gap only opens at 12:10. 12:00 is still
// inside lesson 4's window, which is why it cannot be used as "between".
const BETWEEN_LESSONS = new Date('2026-10-06T11:30:00.000Z');

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

vi.mock('@/libs/api/permissions', () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `LR-ADMIN-${suffix}`;
const STUDENT = crypto.randomUUID();
const TOKEN = `tok-lr-${crypto.randomUUID()}`;

let sectionId = '';
let afternoonSlotId = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN,
    tenantId,
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

// A scan writes no attendance row in either mode, so "nothing was written" is
// the tenant-wide check, not just this student's.
async function attendanceRows() {
  return db
    .select({ period: attendance.period, status: attendance.status })
    .from(attendance)
    .where(eq(attendance.tenantId, tenantId));
}

async function acceptedStatuses() {
  const rows = await db
    .select({ stagedStatus: attendanceScanEvents.stagedStatus })
    .from(attendanceScanEvents)
    .where(and(
      eq(attendanceScanEvents.tenantId, tenantId),
      eq(attendanceScanEvents.resultStatus, 'accepted'),
    ));
  return rows.map(r => r.stagedStatus);
}

describe.skipIf(!dbReachable)('QR lesson resolution — DB-backed', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `LessRes ${suffix}`, slug: `lessres-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `LR-${suffix}`, code: `LR-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'LR Admin', email: `lra-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT, tenantId, branchId: branch!.id, name: 'LR Student', email: `lrs-${suffix}@t.local`, role: 'student' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `SY-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    }).returning();

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `LR1-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `LR-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = cs!.id;
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.id, STUDENT));

    const [subject] = await db.insert(subjects).values({ tenantId, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

    const [version] = await db.insert(timetableVersions).values({
      tenantId,
      sessionYearId: sessionYear!.id,
      status: 'published',
      versionNumber: 1,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2027-06-30',
      createdBy: ADMIN,
    }).returning();

    // Five lessons, so the 14:00 one is genuinely the FIFTH of the day. Under the
    // old code a 14:10 scan was written to period 1 — the 08:00 lesson.
    const base = { tenantId, classSectionId: sectionId, classSubjectId: classSubject!.id, teacherId: ADMIN, dayOfWeek: 'tuesday' as const, versionId: version!.id };
    const slots = await db.insert(classScheduleSlots).values([
      { ...base, startTime: '08:00', endTime: '08:55' },
      { ...base, startTime: '09:00', endTime: '09:55' },
      { ...base, startTime: '10:00', endTime: '10:55' },
      { ...base, startTime: '11:00', endTime: '11:55' },
      { ...base, startTime: '14:00', endTime: '14:55' },
    ]).returning();

    afternoonSlotId = slots[4]!.id;

    await db.insert(identityBadgeCredentials).values({ tenantId, userId: STUDENT, tokenHash: computeHmacHash(TOKEN), status: 'active' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, tenantId));
    await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, tenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('LR.1: a 14:10 scan reports the FIFTH lesson, not period 1', async () => {
    await asAdmin();
    const res = await scan({ rawToken: TOKEN, classSectionId: sectionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.lesson.period).toBe(5);
    expect(json.data.lesson.startTime).toBe('14:00');

    // 14:10 against a 14:00 start with 15 min grace is on time; against the old
    // school-wide 08:00 it would have been late every single afternoon.
    expect(await acceptedStatuses()).toEqual(['present']);
    expect(await attendanceRows()).toHaveLength(0);
  });

  it('LR.2: a scan between lessons still arrives, and reports no lesson', async () => {
    vi.setSystemTime(BETWEEN_LESSONS); // 12:30 Casablanca, no lesson running
    try {
      await asAdmin();
      const res = await scan({ rawToken: TOKEN, classSectionId: sectionId });

      // A lesson is informational in entrance mode: no lesson is not a refusal.
      expect(res.status).toBe(200);

      const json = await res.json() as any;

      expect(json.data.lesson).toBeNull();
      expect(json.data.arrivalOnly).toBe(true);
      expect(await attendanceRows()).toHaveLength(0);
    } finally {
      vi.setSystemTime(FROZEN_NOW);
    }
  });

  it('LR.3: a cancelled lesson is not the lesson a scan reports', async () => {
    await db.insert(classSessionExceptions).values({
      tenantId,
      classScheduleSlotId: afternoonSlotId,
      date: TODAY,
      type: 'CANCELLED',
      reason: 'Sortie scolaire',
      createdById: ADMIN,
    });

    try {
      await asAdmin();
      const res = await scan({ rawToken: TOKEN, classSectionId: sectionId });

      expect(res.status).toBe(200);

      const json = await res.json() as any;

      // The 14:00 lesson is the only one in window at 14:10, and it is not
      // happening — so nothing is reported as the scanned lesson.
      expect(json.data.lesson).toBeNull();
      expect(await attendanceRows()).toHaveLength(0);
    } finally {
      await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, tenantId));
    }
  });

  it('LR.4: an explicit admin override is honoured when it is a real occurrence', async () => {
    await asAdmin();

    const res = await scan({ rawToken: TOKEN, classSectionId: sectionId, period: 2 });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.lesson.period).toBe(2);
    expect(await attendanceRows()).toHaveLength(0);
  });

  it('LR.5: an override for a lesson that does not exist is refused, not invented', async () => {
    await asAdmin();

    const res = await scan({ rawToken: TOKEN, classSectionId: sectionId, period: 9 });

    expect(res.status).toBe(422);
    expect((await res.json() as any).error.code).toBe('LESSON_NOT_SCHEDULED');
    expect(await attendanceRows()).toHaveLength(0);
  });
});
