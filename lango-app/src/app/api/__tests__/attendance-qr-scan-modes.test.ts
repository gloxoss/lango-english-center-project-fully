import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as openScanSession } from '@/app/api/attendance/qr/scanner-sessions/route';
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
  scannerSessions,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// fix-plan-02: scanning has two homes and the SESSION is what picks between
// them. A classroom session is bound to one lesson occurrence — the session
// names the lesson, so the clock can only decide present vs late, never which
// lesson. An entrance (portique) session accepts any student of the tenant at
// any time and records a campus arrival.
//
// Neither mode writes an `attendance` row: the accepted scan event is the whole
// output, and its NULL attendanceRecordId is what "not yet validated" means.

// Clock pinned around a Casablanca Tuesday (UTC+1 in October).
const TODAY = '2026-10-06';
const AT_1407 = new Date('2026-10-06T13:07:00.000Z'); // 14:07 Casablanca
const AT_1357 = new Date('2026-10-06T12:57:00.000Z'); // 13:57 Casablanca
const AT_1200 = new Date('2026-10-06T11:00:00.000Z'); // 12:00 Casablanca

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

type Provisioned = {
  tenantId: string;
  adminId: string;
  /** The 14:00 slot the classroom session is bound to. */
  afternoonSlotId: string;
  sectionA: string;
  sectionB: string;
  studentA: string;
  studentB: string;
  studentBName: string;
  /** "M1-xxxx B-xxxx" — the class + section label the refusal must name. */
  studentBSectionLabel: string;
  tokenA: string;
  tokenB: string;
  classroomSessionId: string;
  entranceSessionId: string;
};

async function provision(name: string): Promise<Provisioned> {
  const tenantId = crypto.randomUUID();
  const suffix = crypto.randomUUID().slice(0, 8);
  const adminId = `MODE-ADMIN-${tenantId}`;
  const studentA = crypto.randomUUID();
  const studentB = crypto.randomUUID();
  const studentBName = `Modes Student B ${suffix}`;
  const tokenA = `tok-mode-a-${crypto.randomUUID()}`;
  const tokenB = `tok-mode-b-${crypto.randomUUID()}`;

  await db.insert(tenants).values({ id: tenantId, name: `${name}-${suffix}`, slug: `${name}-${suffix}` });
  const [branch] = await db.insert(branches).values({ tenantId, name: `C-${suffix}`, code: `M-${suffix}` }).returning();
  await db.insert(user).values([
    { id: adminId, tenantId, branchId: branch!.id, name: 'Modes Admin', email: `ma-${suffix}@t.local`, role: 'school_admin' },
    { id: studentA, tenantId, branchId: branch!.id, name: 'Modes Student A', email: `m-a-${suffix}@t.local`, role: 'student' },
    { id: studentB, tenantId, branchId: branch!.id, name: studentBName, email: `m-b-${suffix}@t.local`, role: 'student' },
  ]);

  const [sessionYear] = await db.insert(sessionYears).values({
    tenantId,
    name: `SY-${suffix}`,
    startDate: '2026-09-01',
    endDate: '2027-06-30',
    isDefault: true,
  }).returning();

  const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
  const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `M1-${suffix}`, mediumId: medium!.id }).returning();
  const labels = await db.insert(sections).values([
    { tenantId, name: `A-${suffix}` },
    { tenantId, name: `B-${suffix}` },
  ]).returning();
  const csRows = await db.insert(classSections).values([
    { tenantId, classId: cls!.id, sectionId: labels[0]!.id, mediumId: medium!.id, maxStudents: 30 },
    { tenantId, classId: cls!.id, sectionId: labels[1]!.id, mediumId: medium!.id, maxStudents: 30 },
  ]).returning();

  const sectionA = csRows[0]!.id;
  const sectionB = csRows[1]!.id;
  await db.update(user).set({ classSectionId: sectionA }).where(eq(user.id, studentA));
  await db.update(user).set({ classSectionId: sectionB }).where(eq(user.id, studentB));

  const [subject] = await db.insert(subjects).values({ tenantId, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
  const [cs] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

  const [version] = await db.insert(timetableVersions).values({
    tenantId,
    sessionYearId: sessionYear!.id,
    status: 'published',
    versionNumber: 1,
    effectiveFrom: '2026-09-01',
    effectiveTo: '2027-06-30',
    createdBy: adminId,
  }).returning();

  // Two lessons for section A. At 13:57 BOTH windows are open (12:55-14:05 and
  // 13:55-15:10), so a clock-driven resolution would pick the 13:00 one — which
  // is exactly what the classroom session must be able to override.
  const slots = await db.insert(classScheduleSlots).values([
    { tenantId, classSectionId: sectionA, classSubjectId: cs!.id, teacherId: adminId, dayOfWeek: 'tuesday', startTime: '13:00', endTime: '13:50', versionId: version!.id },
    { tenantId, classSectionId: sectionA, classSubjectId: cs!.id, teacherId: adminId, dayOfWeek: 'tuesday', startTime: '14:00', endTime: '14:55', versionId: version!.id },
  ]).returning();

  await db.insert(identityBadgeCredentials).values([
    { tenantId, userId: studentA, tokenHash: computeHmacHash(tokenA), status: 'active' },
    { tenantId, userId: studentB, tokenHash: computeHmacHash(tokenB), status: 'active' },
  ]);

  const sessionRows = await db.insert(scannerSessions).values([
    {
      tenantId,
      operatorId: adminId,
      classSectionId: sectionA,
      classScheduleSlotId: slots[1]!.id,
      date: TODAY,
      status: 'active',
    },
    {
      tenantId,
      operatorId: adminId,
      classSectionId: null,
      classScheduleSlotId: null,
      date: TODAY,
      status: 'active',
    },
  ]).returning();

  return {
    tenantId,
    adminId,
    afternoonSlotId: slots[1]!.id,
    sectionA,
    sectionB,
    studentA,
    studentB,
    studentBName,
    studentBSectionLabel: `M1-${suffix} B-${suffix}`,
    tokenA,
    tokenB,
    classroomSessionId: sessionRows[0]!.id,
    entranceSessionId: sessionRows[1]!.id,
  };
}

async function asAdmin(p: Provisioned) {
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

function startSession(body: unknown): Promise<Response> {
  return openScanSession(new Request('http://x/api/attendance/qr/scanner-sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as any).error?.code;
}

async function acceptedEvents(p: Provisioned, sessionId: string) {
  return db
    .select()
    .from(attendanceScanEvents)
    .where(and(
      eq(attendanceScanEvents.tenantId, p.tenantId),
      eq(attendanceScanEvents.sessionId, sessionId),
      eq(attendanceScanEvents.resultStatus, 'accepted'),
    ));
}

/** Every mark of the tenant, voided or not: a scan must write none at all. */
async function attendanceRows(p: Provisioned) {
  return db.select().from(attendance).where(eq(attendance.tenantId, p.tenantId));
}

async function removeTenant(p: Provisioned) {
  await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, p.tenantId));
  await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, p.tenantId));
  await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, p.tenantId));
  await db.delete(attendance).where(eq(attendance.tenantId, p.tenantId));
  await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, p.tenantId));
  await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, p.tenantId));
  await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, p.tenantId));
  await db.delete(classSubjects).where(eq(classSubjects.tenantId, p.tenantId));
  await db.delete(subjects).where(eq(subjects.tenantId, p.tenantId));
  await db.delete(classSections).where(eq(classSections.tenantId, p.tenantId));
  await db.delete(classes).where(eq(classes.tenantId, p.tenantId));
  await db.delete(sections).where(eq(sections.tenantId, p.tenantId));
  await db.delete(mediums).where(eq(mediums.tenantId, p.tenantId));
  await db.delete(sessionYears).where(eq(sessionYears.tenantId, p.tenantId));
  await db.delete(user).where(eq(user.tenantId, p.tenantId));
  await db.delete(branches).where(eq(branches.tenantId, p.tenantId));
  await db.delete(tenants).where(eq(tenants.id, p.tenantId));
}

describe.skipIf(!dbReachable)('QR scan modes — DB-backed', () => {
  let classroom: Provisioned;
  let wrongClass: Provisioned;
  let beforeWindow: Provisioned;
  let entranceNoLesson: Provisioned;
  let entranceWithLesson: Provisioned;
  let duplicate: Provisioned;
  let cancelled: Provisioned;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    classroom = await provision('mode-class');
    wrongClass = await provision('mode-wrong');
    beforeWindow = await provision('mode-early');
    entranceNoLesson = await provision('mode-gate-none');
    entranceWithLesson = await provision('mode-gate-lesson');
    duplicate = await provision('mode-dup');
    cancelled = await provision('mode-cancelled');
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const p of [classroom, wrongClass, beforeWindow, entranceNoLesson, entranceWithLesson, duplicate, cancelled]) {
      if (p) {
        await removeTenant(p);
      }
    }
  });

  it('M1: a classroom session stages for the SCAN EVENT only — no attendance row', async () => {
    vi.setSystemTime(AT_1407);
    await asAdmin(classroom);

    const res = await scan({ rawToken: classroom.tokenA, sessionId: classroom.classroomSessionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.resultStatus).toBe('accepted');
    expect(json.data.mode).toBe('classroom');
    expect(json.data.arrivalOnly).toBe(false);
    expect(json.data.stagedStatus).toBe('present');
    expect(json.data.lesson.startTime).toBe('14:00');

    const events = await acceptedEvents(classroom, classroom.classroomSessionId);

    expect(events).toHaveLength(1);
    expect(events[0]!.stagedStatus).toBe('present');
    expect(events[0]!.classSectionId).toBe(classroom.sectionA);
    // NULL is how "staged, not yet validated" is represented downstream.
    expect(events[0]!.attendanceRecordId).toBeNull();

    expect(await attendanceRows(classroom)).toHaveLength(0);
  });

  it('M2: a classroom session refuses another section, naming the student', async () => {
    vi.setSystemTime(AT_1407);
    await asAdmin(wrongClass);

    const res = await scan({ rawToken: wrongClass.tokenB, sessionId: wrongClass.classroomSessionId });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('WRONG_CLASS');
    // The operator has to see WHO is holding the wrong badge...
    expect(json.error.message).toContain(wrongClass.studentBName);
    // ...AND which section that student does belong to, so the teacher can send
    // them to the right room instead of just knowing they are in the wrong one.
    // "Rania Sefrioui — 2nde A", not "Rania Sefrioui".
    expect(json.error.message).toContain(wrongClass.studentBSectionLabel);
    expect(json.error.details?.studentSection).toBe(wrongClass.studentBSectionLabel);

    expect(await acceptedEvents(wrongClass, wrongClass.classroomSessionId)).toHaveLength(0);
    expect(await attendanceRows(wrongClass)).toHaveLength(0);
  });

  it('M3: a classroom session scans the SESSION\'s lesson, not the one the clock falls into', async () => {
    vi.setSystemTime(AT_1357);
    await asAdmin(beforeWindow);

    const res = await scan({ rawToken: beforeWindow.tokenA, sessionId: beforeWindow.classroomSessionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    // 13:57 falls inside the 13:00 lesson's window too, so a clock-driven
    // resolution would report period 1 and judge the student late against 13:00.
    expect(json.data.mode).toBe('classroom');
    expect(json.data.lesson.period).toBe(2);
    expect(json.data.lesson.startTime).toBe('14:00');
    expect(json.data.stagedStatus).toBe('present');

    const events = await acceptedEvents(beforeWindow, beforeWindow.classroomSessionId);

    expect(events).toHaveLength(1);
    expect(events[0]!.stagedStatus).toBe('present');

    expect(await attendanceRows(beforeWindow)).toHaveLength(0);
  });

  it('M4: an entrance scan with no lesson running is accepted, and is an arrival only', async () => {
    vi.setSystemTime(AT_1200);
    await asAdmin(entranceNoLesson);

    const res = await scan({ rawToken: entranceNoLesson.tokenA, sessionId: entranceNoLesson.entranceSessionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    // NOT NO_LESSON_NOW: a portique accepts a student at any time.
    expect(json.data.resultStatus).toBe('accepted');
    expect(json.data.mode).toBe('entrance');
    expect(json.data.arrivalOnly).toBe(true);
    expect(json.data.lesson).toBeNull();

    const events = await acceptedEvents(entranceNoLesson, entranceNoLesson.entranceSessionId);

    expect(events).toHaveLength(1);
    expect(events[0]!.stagedStatus).toBe('present');
    // The student's own section, so the class-scoped scan feed can still see it.
    expect(events[0]!.classSectionId).toBe(entranceNoLesson.sectionA);

    expect(await attendanceRows(entranceNoLesson)).toHaveLength(0);
  });

  it('M5: an entrance scan while a lesson IS running reports it, and still stages', async () => {
    vi.setSystemTime(AT_1407);
    await asAdmin(entranceWithLesson);

    const res = await scan({ rawToken: entranceWithLesson.tokenA, sessionId: entranceWithLesson.entranceSessionId });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.mode).toBe('entrance');
    expect(json.data.arrivalOnly).toBe(false);
    // The informational line: "arrivé à 14:07 — en retard pour ...".
    expect(json.data.lesson.startTime).toBe('14:00');
    expect(json.data.lesson.period).toBe(2);

    expect(await acceptedEvents(entranceWithLesson, entranceWithLesson.entranceSessionId)).toHaveLength(1);
    expect(await attendanceRows(entranceWithLesson)).toHaveLength(0);
  });

  it('M6: the same badge in the same session is already_scanned, never a second acceptance', async () => {
    vi.setSystemTime(AT_1407);
    await asAdmin(duplicate);

    const first = await scan({ rawToken: duplicate.tokenA, sessionId: duplicate.classroomSessionId });

    expect(first.status).toBe(200);

    const second = await scan({ rawToken: duplicate.tokenA, sessionId: duplicate.classroomSessionId });

    expect(second.status).toBe(200);

    const json = await second.json() as any;

    expect(json.data.resultStatus).toBe('already_scanned');

    // One acceptance, one duplicate attempt — the duplicate is its own event.
    expect(await acceptedEvents(duplicate, duplicate.classroomSessionId)).toHaveLength(1);

    const all = await db
      .select({ resultStatus: attendanceScanEvents.resultStatus })
      .from(attendanceScanEvents)
      .where(and(
        eq(attendanceScanEvents.tenantId, duplicate.tenantId),
        eq(attendanceScanEvents.sessionId, duplicate.classroomSessionId),
      ));

    expect(all.filter(e => e.resultStatus === 'accepted')).toHaveLength(1);
    expect(all.filter(e => e.resultStatus === 'already_scanned')).toHaveLength(1);
    expect(await attendanceRows(duplicate)).toHaveLength(0);
  });

  it('M7: a cancelled lesson answers LESSON_CANCELLED, the same code the session route uses', async () => {
    vi.setSystemTime(AT_1407);
    await asAdmin(cancelled);

    // The lesson the classroom session is bound to is called off after the
    // session was opened — a school outing, say.
    await db.insert(classSessionExceptions).values({
      tenantId: cancelled.tenantId,
      classScheduleSlotId: cancelled.afternoonSlotId,
      date: TODAY,
      type: 'CANCELLED',
      reason: 'Sortie scolaire',
      createdById: cancelled.adminId,
    });

    const scanRes = await scan({ rawToken: cancelled.tokenA, sessionId: cancelled.classroomSessionId });
    const sessionRes = await startSession({ slotId: cancelled.afternoonSlotId, date: TODAY });

    expect(scanRes.status).toBe(422);
    expect(sessionRes.status).toBe(422);

    const scanCode = await errorCode(scanRes);
    const sessionCode = await errorCode(sessionRes);

    expect(scanCode).toBe('LESSON_CANCELLED');
    // One condition, one code: opening a scan session for a cancelled lesson and
    // scanning into one must not disagree, which is what pinned these two routes
    // together here rather than in a shared constant neither file owns.
    expect(sessionCode).toBe(scanCode);

    // Refused at the door: nothing accepted, nothing marked.
    expect(await acceptedEvents(cancelled, cancelled.classroomSessionId)).toHaveLength(0);
    expect(await attendanceRows(cancelled)).toHaveLength(0);
  });
});
