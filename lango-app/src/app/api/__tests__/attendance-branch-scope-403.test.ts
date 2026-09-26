import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { POST as postAuditReminder } from '@/app/api/attendance/audit-summary/route';
import { GET as getDay } from '@/app/api/attendance/day/route';
import { POST as postExcuse, PATCH as reviewExcuse } from '@/app/api/attendance/excuses/route';
import { POST as postExcuseDocument } from '@/app/api/attendance/excuses/document/route';
import { PATCH as patchFlag } from '@/app/api/attendance/flags/route';
import { POST as postFlagNote } from '@/app/api/attendance/flags/notes/route';
import { POST as startSession, GET as getOpenSession } from '@/app/api/attendance/qr/scanner-sessions/route';
import { POST as closeSession } from '@/app/api/attendance/qr/scanner-sessions/[id]/close/route';
import { GET as sessionEvents } from '@/app/api/attendance/qr/scanner-sessions/[id]/events/route';
import { POST as verifyAndStage } from '@/app/api/attendance/qr/verify-and-stage/route';
import { POST as lateComplete } from '@/app/api/attendance/registers/late-complete/route';
import { POST as postException, DELETE as deleteException } from '@/app/api/attendance/session-exceptions/route';
import { PATCH as correctPunch } from '@/app/api/workforce/punches/[id]/route';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { db } from '@/libs/DB';
import {
  attendanceScanEvents,
  attendanceExcuses,
  attendanceFlags,
  attendanceRegisters,
  branches,
  classScheduleSlots,
  classSections,
  classSessionExceptions,
  classSubjects,
  classTeachers,
  classes,
  identityBadgeCredentials,
  mediums,
  scannerSessions,
  sections,
  sessionYears,
  subjects,
  timetableVersions,
  tenants,
  user,
  workforcePunchEvents,
} from '@/models/Schema';

// BRANCH-SCOPE pass over the attendance write routes: a campus-limited admin
// (Annexe Maarif) must get 403 on every write that targets the other campus
// (Siège), and the reads must not leak it either. Owner rule for teachers
// stays ASSIGNMENTS WIN — that side is pinned by attendance-teacher-scope.
//
// late-complete is deliberately asserted as 404, not 403: the occurrence
// resolver pre-filters by the caller's branch, so another campus's slot is
// simply not found. The in-route assertBranchScope stays as defense in depth
// (exception-merged occurrences); it cannot fire for this request shape.

const FROZEN_NOW = new Date('2026-10-06T13:10:00.000Z'); // 14:10 Casablanca, Tuesday
const TODAY = '2026-10-06';
const YESTERDAY = '2026-10-05'; // Monday

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
  hasCapability: vi.fn(async () => true),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/features/broadcast/services/sms-delivery', () => ({ sendSmsMessage: vi.fn(async () => ({ id: 'sms-test' })) }));
vi.mock('@/features/broadcast/services/consent-service', () => ({ checkConsent: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/libs/api/attendance-flags', () => ({ resolveUnjustifiedAbsenceFlagsForDate: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/attendance-summary', () => ({ recalculateStudentAttendanceSummary: vi.fn(async () => undefined) }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const BRANCH_A = crypto.randomUUID(); // Siège
const BRANCH_B = crypto.randomUUID(); // Annexe Maarif
const ADMIN_A = `USR-BSA-${suffix}`;
const ADMIN_B = `USR-BSB-${suffix}`;
const TEACHER_A = `USR-TA-${suffix}`;
const TEACHER_B = `USR-TB-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const BADGE_TOKEN = `tok-bs-${suffix}`;

let classSectionA = '';
let classSectionB = '';
let slotATue = '';
let slotAMon = '';
let excuseAId = '';
let excuseBId = '';
let flagAId = '';
let legacyRegisterAId = '';
let scannerSessionAId = '';
let punchAId = '';

async function actAs(userId: string, role: 'school_admin' | 'teacher', branchId: string | null) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId, role, branchId } as RequestContext);
}

function json(url: string, method: string, body: unknown): Request {
  return new Request(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

describe.skipIf(!dbReachable)('attendance branch scope — campus-limited admin 403 matrix', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `AttBS ${suffix}`, slug: `attbs-${suffix}` });
    await db.insert(branches).values([
      { id: BRANCH_A, tenantId, name: `Siege-${suffix}`, code: `BSA-${suffix}` },
      { id: BRANCH_B, tenantId, name: `Maarif-${suffix}`, code: `BSB-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: ADMIN_A, tenantId, branchId: BRANCH_A, name: 'Admin Siege', email: `bsa-${suffix}@t.local`, role: 'school_admin' },
      { id: ADMIN_B, tenantId, branchId: BRANCH_B, name: 'Admin Maarif', email: `bsb-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER_A, tenantId, branchId: BRANCH_A, name: 'Prof Siege', email: `bsta-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_B, tenantId, branchId: BRANCH_B, name: 'Prof Maarif', email: `bstb-${suffix}@t.local`, role: 'teacher' },
      { id: STUDENT_A, tenantId, branchId: BRANCH_A, classSectionId: null, name: 'Eleve Siege', email: `bssa-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: BRANCH_B, classSectionId: null, name: 'Eleve Maarif', email: `bssb-${suffix}@t.local`, role: 'student' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `SY-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    }).returning();

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [classA] = await db.insert(classes).values({ tenantId, branchId: BRANCH_A, name: `SIEGE1-${suffix}`, mediumId: medium!.id }).returning();
    const [classB] = await db.insert(classes).values({ tenantId, branchId: BRANCH_B, name: `MAARIF1-${suffix}`, mediumId: medium!.id }).returning();
    const [labelA] = await db.insert(sections).values({ tenantId, name: `BSA-${suffix}` }).returning();
    const [labelB] = await db.insert(sections).values({ tenantId, name: `BSB-${suffix}` }).returning();
    const [csA] = await db.insert(classSections).values({ tenantId, classId: classA!.id, sectionId: labelA!.id, mediumId: medium!.id }).returning();
    const [csB] = await db.insert(classSections).values({ tenantId, classId: classB!.id, sectionId: labelB!.id, mediumId: medium!.id }).returning();
    classSectionA = csA!.id;
    classSectionB = csB!.id;
    await db.update(user).set({ classSectionId: classSectionA }).where(eq(user.id, STUDENT_A));
    await db.update(user).set({ classSectionId: classSectionB }).where(eq(user.id, STUDENT_B));

    const [subject] = await db.insert(subjects).values({ tenantId, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [csjA] = await db.insert(classSubjects).values({ tenantId, classId: classA!.id, subjectId: subject!.id, type: 'compulsory' }).returning();
    const [csjB] = await db.insert(classSubjects).values({ tenantId, classId: classB!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

    const [version] = await db.insert(timetableVersions).values({
      tenantId,
      sessionYearId: sessionYear!.id,
      status: 'published',
      versionNumber: 1,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2027-06-30',
      createdBy: ADMIN_A,
    }).returning();

    const slots = await db.insert(classScheduleSlots).values([
      { tenantId, classSectionId: classSectionA, classSubjectId: csjA!.id, teacherId: TEACHER_A, dayOfWeek: 'tuesday', startTime: '14:00', endTime: '14:55', versionId: version!.id },
      { tenantId, classSectionId: classSectionA, classSubjectId: csjA!.id, teacherId: TEACHER_A, dayOfWeek: 'monday', startTime: '14:00', endTime: '14:55', versionId: version!.id },
      { tenantId, classSectionId: classSectionB, classSubjectId: csjB!.id, teacherId: TEACHER_B, dayOfWeek: 'tuesday', startTime: '09:00', endTime: '09:55', versionId: version!.id },
    ]).returning();
    slotATue = slots[0]!.id;
    slotAMon = slots[1]!.id;

    // Teacher assignments pin the ASSIGNMENTS WIN side of the day-route test.
    await db.insert(classTeachers).values([
      { tenantId, teacherId: TEACHER_A, classSectionId: classSectionA, status: 'active' },
      { tenantId, teacherId: TEACHER_B, classSectionId: classSectionB, status: 'active' },
    ]);

    const [excuseA] = await db.insert(attendanceExcuses).values({
      tenantId, studentId: STUDENT_A, classSectionId: classSectionA, period: 1, sessionYearId: sessionYear!.id, date: TODAY, reason: `BS excuse A ${suffix}`, status: 'pending',
    }).returning();
    const [excuseB] = await db.insert(attendanceExcuses).values({
      tenantId, studentId: STUDENT_B, classSectionId: classSectionB, period: 1, sessionYearId: sessionYear!.id, date: TODAY, reason: `BS excuse B ${suffix}`, status: 'pending',
    }).returning();
    excuseAId = excuseA!.id;
    excuseBId = excuseB!.id;

    const [flagA] = await db.insert(attendanceFlags).values({
      tenantId, studentId: STUDENT_A, type: 'UNJUSTIFIED_ABSENCE',
    }).returning();
    flagAId = flagA!.id;

    // Legacy (slot-less) register of the SIEGE class, yesterday.
    const [legacyReg] = await db.insert(attendanceRegisters).values({
      tenantId, classId: classA!.id, classSectionId: null, sessionYearId: sessionYear!.id,
      date: YESTERDAY, period: 1, reference: `BS-LEG-${suffix}`, status: 'LOCKED', submittedById: ADMIN_A,
    }).returning();
    legacyRegisterAId = legacyReg!.id;

    const [scanSessionA] = await db.insert(scannerSessions).values({
      tenantId, operatorId: TEACHER_A, classSectionId: classSectionA, classScheduleSlotId: slotATue,
      date: TODAY, startedAt: new Date().toISOString(), status: 'active',
    }).returning();
    scannerSessionAId = scanSessionA!.id;

    const [punchA] = await db.insert(workforcePunchEvents).values({
      tenantId, employeeId: TEACHER_A, punchType: 'in', scannedAt: new Date().toISOString(),
    }).returning();
    punchAId = punchA!.id;

    await db.insert(identityBadgeCredentials).values({
      tenantId, userId: STUDENT_A, tokenHash: computeHmacHash(BADGE_TOKEN), status: 'active', issuerId: ADMIN_A,
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
    await db.delete(workforcePunchEvents).where(eq(workforcePunchEvents.tenantId, tenantId));
    await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, tenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('excuses PATCH: reviewing the other campus excuse is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await reviewExcuse(json('http://x/api/attendance/excuses', 'PATCH', { excuseId: excuseAId, status: 'approved' }));
    expect(res.status).toBe(403);
  });

  it('excuses PATCH: lessons pointing at the other campus are refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await reviewExcuse(json('http://x/api/attendance/excuses', 'PATCH', {
      excuseId: excuseBId,
      status: 'approved',
      lessons: [{ classSectionId: classSectionA, period: 2 }],
    }));
    expect(res.status).toBe(403);
  });

  it('excuses POST: creating for the other campus student is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await postExcuse(json('http://x/api/attendance/excuses', 'POST', {
      studentId: STUDENT_A, date: TODAY, reason: `BS cross ${suffix}`,
    }));
    expect(res.status).toBe(403);
  });

  it('excuses document POST: uploading for the other campus excuse is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const form = new FormData();
    form.append('excuseId', excuseAId);
    form.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'justif.pdf', { type: 'application/pdf' }));
    const res = await postExcuseDocument(new Request('http://x/api/attendance/excuses/document', { method: 'POST', body: form }));
    expect(res.status).toBe(403);
  });

  it('attendance POST: batch-marking the other campus section is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await postAttendance(json('http://x/api/attendance', 'POST', {
      date: TODAY,
      studentGroupId: classSectionA,
      period: 1,
      records: [{ studentId: STUDENT_A, status: 'absent' }],
    }));
    expect(res.status).toBe(403);
  });

  it('flags PATCH: reviewing the other campus flag is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await patchFlag(json('http://x/api/attendance/flags', 'PATCH', { flagId: flagAId, status: 'ACKNOWLEDGED' }));
    expect(res.status).toBe(403);
  });

  it('flags notes POST: noting the other campus flag is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await postFlagNote(json('http://x/api/attendance/flags/notes', 'POST', { flagId: flagAId, body: `BS note ${suffix}` }));
    expect(res.status).toBe(403);
  });

  it('audit-summary POST: reminding the other campus teacher is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await postAuditReminder(json('http://x/api/attendance/audit-summary', 'POST', { classScheduleSlotId: slotAMon }));
    expect(res.status).toBe(403);
  });

  it('session-exceptions POST/DELETE: the other campus slot is out of scope', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const post = await postException(json('http://x/api/attendance/session-exceptions', 'POST', {
      classScheduleSlotId: slotAMon, date: YESTERDAY, type: 'CANCELLED', reason: `BS test ${suffix}`,
    }));
    expect(post.status).toBe(403);
    const del = await deleteException(new Request(`http://x/api/attendance/session-exceptions?classScheduleSlotId=${slotAMon}&date=${YESTERDAY}`, { method: 'DELETE' }));
    expect(del.status).toBe(403);
  });

  it('registers late-complete: the other campus slot is not found (no leak)', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await lateComplete(json('http://x/api/attendance/registers/late-complete', 'POST', {
      slotId: slotAMon, date: YESTERDAY, reason: `BS late ${suffix}`,
    }));
    expect(res.status).toBe(404);
  });

  it('scanner-sessions POST: opening a classroom session on the other campus is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await startSession(json('http://x/api/attendance/qr/scanner-sessions', 'POST', { slotId: slotATue, date: TODAY }));
    expect(res.status).toBe(403);
  });

  it('scanner-sessions GET: the other campus open session is invisible', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await getOpenSession(new Request(`http://x/api/attendance/qr/scanner-sessions?slotId=${slotATue}&date=${TODAY}`));
    expect(res.status).toBe(403);
  });

  it('scanner-sessions close: the other campus session cannot be consumed', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await closeSession(new Request('http://x/close', { method: 'POST' }), { params: Promise.resolve({ id: scannerSessionAId }) });
    expect(res.status).toBe(403);
  });

  it('scanner-sessions close: an unassigned teacher cannot consume another teacher session', async () => {
    await actAs(TEACHER_B, 'teacher', BRANCH_B);
    const res = await closeSession(new Request('http://x/close', { method: 'POST' }), { params: Promise.resolve({ id: scannerSessionAId }) });
    expect(res.status).toBe(403);
  });

  it('scanner-sessions events: the other campus scan feed is invisible', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await sessionEvents(new Request('http://x/events'), { params: Promise.resolve({ id: scannerSessionAId }) });
    expect(res.status).toBe(403);
  });

  it('verify-and-stage: a badge of the other campus is refused and logged', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await verifyAndStage(json('http://x/api/attendance/qr/verify-and-stage', 'POST', {
      rawToken: BADGE_TOKEN,
      idempotencyKey: `bs-${suffix}-1`,
    }));
    expect(res.status).toBe(403);
    const [rejected] = await db
      .select({ reason: attendanceScanEvents.rejectionReason, status: attendanceScanEvents.resultStatus })
      .from(attendanceScanEvents)
      .where(and(eq(attendanceScanEvents.tenantId, tenantId), eq(attendanceScanEvents.idempotencyKey, `bs-${suffix}-1`)));
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.reason).toBe('WRONG_BRANCH');
  });

  it('day GET: legacy registers of the other campus are hidden (admin and teacher)', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const adminRes = await getDay(new Request(`http://x/api/attendance/day?date=${YESTERDAY}`));
    expect(adminRes.status).toBe(200);
    const adminJson = await adminRes.json();
    expect(adminJson.data.legacyRegisters).toHaveLength(0);

    await actAs(TEACHER_B, 'teacher', BRANCH_B);
    const teacherRes = await getDay(new Request(`http://x/api/attendance/day?date=${YESTERDAY}`));
    expect(teacherRes.status).toBe(200);
    const teacherJson = await teacherRes.json();
    expect(teacherJson.data.legacyRegisters).toHaveLength(0);

    // Controls: their own campus still sees the legacy register.
    await actAs(ADMIN_A, 'school_admin', BRANCH_A);
    const adminARes = await getDay(new Request(`http://x/api/attendance/day?date=${YESTERDAY}`));
    const adminAJson = await adminARes.json();
    expect(adminAJson.data.legacyRegisters.some((r: { id: string }) => r.id === legacyRegisterAId)).toBe(true);

    await actAs(TEACHER_A, 'teacher', BRANCH_A);
    const teacherARes = await getDay(new Request(`http://x/api/attendance/day?date=${YESTERDAY}`));
    const teacherAJson = await teacherARes.json();
    expect(teacherAJson.data.legacyRegisters.some((r: { id: string }) => r.id === legacyRegisterAId)).toBe(true);
  });

  it('workforce punches PATCH: correcting the other campus employee is refused', async () => {
    await actAs(ADMIN_B, 'school_admin', BRANCH_B);
    const res = await correctPunch(json('http://x/punch', 'PATCH', { reason: `BS correction ${suffix}` }), { params: Promise.resolve({ id: punchAId }) });
    expect(res.status).toBe(403);
  });
});
