import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as closeSession } from '@/app/api/attendance/qr/scanner-sessions/[id]/close/route';
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

// THE CLASSROOM CHAIN, END TO END.
//
// The whole point of the reform (fix-plan-02) is that a badge scan does not
// become a mark by itself. So this walks the chain that has to hold together:
//
//   badge scan -> staged scan event, ZERO marks
//   teacher validates -> the roll-call submission writes the marks
//   session closes -> each staged scan is linked to the mark it became
//
// The middle step is represented by inserting the marks the submission writes,
// because that route is unchanged and already has its own coverage. What is new,
// and what this pins, is the two ends.

const GRACE_START = new Date('2026-10-06T13:03:00.000Z'); // 14:03 Casablanca
const LATE_SCAN = new Date('2026-10-06T13:20:00.000Z'); // 14:20, past the 15 min grace
const RESCAN = new Date('2026-10-06T13:25:00.000Z');
const TODAY = '2026-10-06';

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
const ADMIN = `CF-ADMIN-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const TOKEN_A = `tok-cf-a-${crypto.randomUUID()}`;
const TOKEN_B = `tok-cf-b-${crypto.randomUUID()}`;

let sectionId = '';
let classId = '';
let sessionYearId = '';
let sessionId = '';

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
  return verifyAndStage(new Request('http://x/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function close(id: string): Promise<Response> {
  return closeSession(new Request('http://x/close', { method: 'POST' }), { params: Promise.resolve({ id }) });
}

async function markCount() {
  const rows = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(eq(attendance.tenantId, tenantId), eq(attendance.isVoided, false)));
  return rows.length;
}

async function scans() {
  return db
    .select({ studentId: attendanceScanEvents.studentId, result: attendanceScanEvents.resultStatus, staged: attendanceScanEvents.stagedStatus, record: attendanceScanEvents.attendanceRecordId })
    .from(attendanceScanEvents)
    .where(eq(attendanceScanEvents.tenantId, tenantId));
}

describe.skipIf(!dbReachable)('classroom scanning chain', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(GRACE_START);

    await db.insert(tenants).values({ id: tenantId, name: `CFlow ${suffix}`, slug: `cflow-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `CF-${suffix}`, code: `CF-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'CF Admin', email: `cfa-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT_A, tenantId, branchId: branch!.id, name: 'CF A', email: `cf-a-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branch!.id, name: 'CF B', email: `cf-b-${suffix}@t.local`, role: 'student' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `SY-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    }).returning();
    sessionYearId = sessionYear!.id;

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `CF1-${suffix}`, mediumId: medium!.id }).returning();
    classId = cls!.id;
    const [label] = await db.insert(sections).values({ tenantId, name: `CF-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = cs!.id;
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.tenantId, tenantId));

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

    const base = { tenantId, classSectionId: sectionId, classSubjectId: classSubject!.id, teacherId: ADMIN, dayOfWeek: 'tuesday' as const, versionId: version!.id };
    const slots = await db.insert(classScheduleSlots).values([
      { ...base, startTime: '08:00', endTime: '08:55' },
      { ...base, startTime: '10:00', endTime: '10:55' },
      { ...base, startTime: '14:00', endTime: '14:55' },
    ]).returning();

    await db.insert(identityBadgeCredentials).values([
      { tenantId, userId: STUDENT_A, tokenHash: computeHmacHash(TOKEN_A), status: 'active' },
      { tenantId, userId: STUDENT_B, tokenHash: computeHmacHash(TOKEN_B), status: 'active' },
    ]);

    const [session] = await db.insert(scannerSessions).values({
      tenantId,
      operatorId: ADMIN,
      classSectionId: sectionId,
      classScheduleSlotId: slots[2]!.id,
      date: TODAY,
      status: 'active',
    }).returning();
    sessionId = session!.id;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
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

  it('CF.1: a scan in the grace window stages as present and writes NO mark', async () => {
    await asAdmin();
    const res = await scan({ rawToken: TOKEN_A, sessionId });

    expect(res.status).toBe(200);

    const body = await res.json() as any;

    expect(body.data.mode).toBe('classroom');
    expect(body.data.stagedStatus).toBe('present');
    // The lesson is the SESSION's lesson (period 3 at 14:00), not whatever the
    // clock would have picked.
    expect(body.data.lesson.period).toBe(3);
    expect(body.data.lesson.startTime).toBe('14:00');

    expect(await markCount()).toBe(0);

    const staged = await scans();

    expect(staged.filter(s => s.result === 'accepted')).toHaveLength(1);
    expect(staged[0]!.record).toBeNull();
  });

  it('CF.2: a scan past the grace stages as late, still with no mark', async () => {
    vi.setSystemTime(LATE_SCAN);
    try {
      await asAdmin();
      const res = await scan({ rawToken: TOKEN_B, sessionId });

      expect(res.status).toBe(200);
      expect((await res.json() as any).data.stagedStatus).toBe('late');
      expect(await markCount()).toBe(0);
    } finally {
      vi.setSystemTime(GRACE_START);
    }
  });

  it('CF.3: re-scanning the same badge adds no second accepted scan', async () => {
    vi.setSystemTime(RESCAN);
    try {
      await asAdmin();
      const res = await scan({ rawToken: TOKEN_A, sessionId });

      const accepted = (await scans()).filter(s => s.result === 'accepted');

      expect(accepted).toHaveLength(2);
      expect(accepted.filter(s => s.studentId === STUDENT_A)).toHaveLength(1);
      expect(res.status).toBe(200);
    } finally {
      vi.setSystemTime(GRACE_START);
    }
  });

  it('CF.4: validation writes the marks, and closing links every staged scan to its mark', async () => {
    await asAdmin();

    // What "Valider l'appel" produces: the reviewed list, written by the ordinary
    // roll-call submission. Both students were scanned, so both are present/late.
    const marks = await db.insert(attendance).values([
      { tenantId, studentId: STUDENT_A, studentGroupId: classId, classSectionId: sectionId, academicYearId: sessionYearId, date: TODAY, period: 3, status: 'present', markedById: ADMIN },
      { tenantId, studentId: STUDENT_B, studentGroupId: classId, classSectionId: sectionId, academicYearId: sessionYearId, date: TODAY, period: 3, status: 'late', markedById: ADMIN },
    ]).returning();

    expect(marks).toHaveLength(2);

    const res = await close(sessionId);

    expect(res.status).toBe(200);
    expect((await res.json() as any).linked).toBe(2);

    // Only ACCEPTED scans carry a link to a mark. CF.3's duplicate scan is also a
    // scan event, so keying a map off every event would let it shadow the accepted
    // one depending on row order.
    const accepted = (await scans()).filter(s => s.result === 'accepted');
    const byStudent = new Map(accepted.map(s => [s.studentId, s.record]));

    expect(byStudent.size).toBe(2);
    expect(byStudent.get(STUDENT_A)).toBe(marks[0]!.id);
    expect(byStudent.get(STUDENT_B)).toBe(marks[1]!.id);
  });
});
