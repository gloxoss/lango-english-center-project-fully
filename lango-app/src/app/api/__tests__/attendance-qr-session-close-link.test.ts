import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as closeSession } from '@/app/api/attendance/qr/scanner-sessions/[id]/close/route';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceScanEvents,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  scannerSessions,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// Closing a classroom session is what consumes its scans. A badge scan stages an
// accepted scan event with attendanceRecordId NULL; the teacher's validation
// writes the marks; closing points each scan at the mark it became, so Registers
// & historique can still tell a scanned mark from a typed one.
//
// The lookup key is the whole risk here: the link must find the SAME mark the
// submission wrote. That key is (tenant, student, date, period, section), and the
// period must come from the session's own slot, not from the clock.

const FROZEN_NOW = new Date('2026-10-06T13:10:00.000Z'); // 14:10 Casablanca, Tuesday
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
const ADMIN = `CL-ADMIN-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const STUDENT_C = crypto.randomUUID();

let sectionId = '';
let classId = '';
let sessionYearId = '';
let afternoonSlotId = '';

/** A mark shaped exactly as the roll-call submission writes one. */
function mark(studentId: string, period: number, status: 'present' | 'late' | 'absent' | 'excused') {
  return {
    tenantId,
    studentId,
    studentGroupId: classId,
    classSectionId: sectionId,
    academicYearId: sessionYearId,
    date: TODAY,
    period,
    status,
    markedById: ADMIN,
  };
}

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN,
    tenantId,
    role: 'school_admin',
    branchId: null,
  } as RequestContext);
}

function close(id: string): Promise<Response> {
  return closeSession(new Request('http://x/close', { method: 'POST' }), { params: Promise.resolve({ id }) });
}

let sessionId = '';

async function stagedScans() {
  return db
    .select({ id: attendanceScanEvents.id, studentId: attendanceScanEvents.studentId, record: attendanceScanEvents.attendanceRecordId })
    .from(attendanceScanEvents)
    .where(and(eq(attendanceScanEvents.tenantId, tenantId), eq(attendanceScanEvents.sessionId, sessionId)));
}

describe.skipIf(!dbReachable)('scanner session close — links staged scans to written marks', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `Close ${suffix}`, slug: `close-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `CL-${suffix}`, code: `CL-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'CL Admin', email: `cla-${suffix}@t.local`, role: 'school_admin' },
      { id: STUDENT_A, tenantId, branchId: branch!.id, name: 'CL A', email: `cl-a-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branch!.id, name: 'CL B', email: `cl-b-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_C, tenantId, branchId: branch!.id, name: 'CL C', email: `cl-c-${suffix}@t.local`, role: 'student' },
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
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `CL1-${suffix}`, mediumId: medium!.id }).returning();
    classId = cls!.id;
    const [label] = await db.insert(sections).values({ tenantId, name: `CL-${suffix}` }).returning();
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

    // The 14:00 lesson is the THIRD of the day, so its period is 3 and not 1.
    const base = { tenantId, classSectionId: sectionId, classSubjectId: classSubject!.id, teacherId: ADMIN, dayOfWeek: 'tuesday' as const, versionId: version!.id };
    const slots = await db.insert(classScheduleSlots).values([
      { ...base, startTime: '08:00', endTime: '08:55' },
      { ...base, startTime: '10:00', endTime: '10:55' },
      { ...base, startTime: '14:00', endTime: '14:55' },
    ]).returning();
    afternoonSlotId = slots[2]!.id;

    const [session] = await db.insert(scannerSessions).values({
      tenantId,
      operatorId: ADMIN,
      classSectionId: sectionId,
      classScheduleSlotId: afternoonSlotId,
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

  it('CL.1: links each staged scan to the mark the validation wrote, at the SESSION lesson', async () => {
    // Two staged scans, and the marks the teacher's validation produced for them.
    await db.insert(attendanceScanEvents).values([
      { tenantId, sessionId, studentId: STUDENT_A, resultStatus: 'accepted', stagedStatus: 'present', classSectionId: sectionId },
      { tenantId, sessionId, studentId: STUDENT_B, resultStatus: 'accepted', stagedStatus: 'late', classSectionId: sectionId },
    ]);
    const marks = await db.insert(attendance).values([
      mark(STUDENT_A, 3, 'present'),
      mark(STUDENT_B, 3, 'late'),
    ]).returning();

    await asAdmin();
    const res = await close(sessionId);

    expect(res.status).toBe(200);
    expect((await res.json() as any).linked).toBe(2);

    const scans = await stagedScans();

    expect(scans).toHaveLength(2);

    const byStudent = new Map(scans.map(s => [s.studentId, s.record]));

    expect(byStudent.get(STUDENT_A)).toBe(marks[0]!.id);
    expect(byStudent.get(STUDENT_B)).toBe(marks[1]!.id);
  });

  it('CL.2: a wrongly-numbered period would not find the mark, so the link stays null', async () => {
    // Guards the key: a mark on period 1 (the old default bug) must NOT be picked
    // up by a session whose lesson is period 3.
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));

    await db.insert(attendanceScanEvents).values({
      tenantId,
      sessionId,
      studentId: STUDENT_A,
      resultStatus: 'accepted',
      stagedStatus: 'present',
      classSectionId: sectionId,
    });
    await db.insert(attendance).values(mark(STUDENT_A, 1, 'present'));

    await asAdmin();
    const res = await close(sessionId);

    expect((await res.json() as any).linked).toBe(0);

    const scans = await stagedScans();

    expect(scans[0]!.record).toBeNull();
  });

  it('CL.3: a staged scan whose student has no mark stays unlinked, without failing the close', async () => {
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));

    await db.insert(attendanceScanEvents).values([
      { tenantId, sessionId, studentId: STUDENT_A, resultStatus: 'accepted', stagedStatus: 'present', classSectionId: sectionId },
      { tenantId, sessionId, studentId: STUDENT_C, resultStatus: 'accepted', stagedStatus: 'present', classSectionId: sectionId },
    ]);
    await db.insert(attendance).values(mark(STUDENT_A, 3, 'present'));

    await asAdmin();
    const res = await close(sessionId);

    expect(res.status).toBe(200);
    expect((await res.json() as any).linked).toBe(1);

    const scans = await stagedScans();
    const byStudent = new Map(scans.map(s => [s.studentId, s.record]));

    expect(byStudent.get(STUDENT_A)).not.toBeNull();
    expect(byStudent.get(STUDENT_C)).toBeNull();
  });

  it('CL.4: an entrance session links nothing and still closes', async () => {
    const [entrance] = await db.insert(scannerSessions).values({
      tenantId,
      operatorId: ADMIN,
      classSectionId: null,
      classScheduleSlotId: null,
      date: TODAY,
      status: 'active',
    }).returning();
    await db.insert(attendanceScanEvents).values({
      tenantId,
      sessionId: entrance!.id,
      studentId: STUDENT_A,
      resultStatus: 'accepted',
      classSectionId: null,
    });

    await asAdmin();
    const res = await close(entrance!.id);

    expect(res.status).toBe(200);
    expect((await res.json() as any).linked).toBe(0);
  });

  it('CL.5: a session from another tenant is not found', async () => {
    await asAdmin();
    const res = await close(crypto.randomUUID());

    expect(res.status).toBe(404);
  });
});
