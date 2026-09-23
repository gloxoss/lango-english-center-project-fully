import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getAuditSummary } from '@/app/api/attendance/audit-summary/route';
import { POST as postAttendance } from '@/app/api/attendance/route';
import { detectAndRecordFlags } from '@/libs/api/attendance-flags';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceFlags,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  sessionYears,
  smsMessages,
  subjects,
  tenants,
  user,
} from '@/models/Schema';

// G12 — calendar / non-school-day truth (Phase 5):
// G12.1 rejected on non-instructional day · G12.2 zero marks · G12.3 zero
// flags · G12.4 zero SMS intents · G12.5 missing-register ignores outside-
// session dates · G12.6 consecutive absence spans weekends (instructional
// days only) · G12.7 DATE_OUTSIDE_SESSION · G12.10 historical non-
// instructional rows untouched. G12.8/G12.9 NOT APPLICABLE (no exceptional-day
// or branch-calendar model exists).

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
const ADMIN = `USR-CAL-${suffix}`;
const TEACHER = `USR-CAL-T-${suffix}`;
const STUDENT = crypto.randomUUID();
const friday = '2026-10-02';
const saturday = '2026-10-03';
const sunday = '2026-10-04';
const monday = '2026-10-05';
const outside = '2028-01-15';

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

describe.skipIf(!dbReachable)('attendance calendar P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Cal ${suffix}`, slug: `att-cal-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `CA-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Admin', email: `cal-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER, tenantId, branchId: branch!.id, name: 'Teacher', email: `cal-t-${suffix}@t.local`, role: 'teacher' },
      { id: STUDENT, tenantId, branchId: branch!.id, name: 'Student', email: `cal-s-${suffix}@t.local`, role: 'student' },
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

    // One Monday timetable slot — the missing-register detector's authority.
    const [subject] = await db.insert(subjects).values({ tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();
    await db.insert(classScheduleSlots).values([
      {
        tenantId,
        classSectionId: sectionId,
        classSubjectId: classSubject!.id,
        teacherId: TEACHER,
        dayOfWeek: 'monday',
        startTime: '08:00',
        endTime: '10:00',
      },
      {
        tenantId,
        classSectionId: sectionId,
        classSubjectId: classSubject!.id,
        teacherId: TEACHER,
        dayOfWeek: 'friday',
        startTime: '08:00',
        endTime: '10:00',
      },
    ]);
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(smsMessages).where(eq(smsMessages.tenantId, tenantId));
    await db.delete(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
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

  it('G12.1/G12.2/G12.4: roll-call on a non-instructional day is rejected with zero marks and zero SMS intents', async () => {
    // NOTE: this section has a Monday timetable slot; Saturday is not a
    // scheduled meeting day (timetable authority), so the day is rejected.
    const res = await post({ date: saturday, period: 1, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'absent' }] });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('NON_INSTRUCTIONAL_DAY');

    const marks = await db.select({ id: attendance.id }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, saturday)));

    expect(marks).toHaveLength(0);

    const sms = await db.select({ id: smsMessages.id }).from(smsMessages).where(eq(smsMessages.tenantId, tenantId));

    expect(sms).toHaveLength(0);
  });

  it('G12.3: a confirmed non-instructional day generates no absence flags', async () => {
    await detectAndRecordFlags(tenantId, STUDENT, saturday, 'absent');
    await detectAndRecordFlags(tenantId, STUDENT, sunday, 'late');

    const flags = await db.select({ id: attendanceFlags.id }).from(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));

    expect(flags).toHaveLength(0);
  });

  it('G12.6: consecutive absence spans the weekend across instructional days', async () => {
    // Timetable authority: this section meets Mondays and Fridays only.
    // Three consecutive INSTRUCTIONAL days: Mon 09-28, Fri 10-02, Mon 10-05 —
    // the weekend between them must not break the streak (and raw calendar
    // counting would have failed on the missing Sat/Sun).
    await db.insert(attendance).values([
      { tenantId, studentId: STUDENT, classSectionId: sectionId, academicYearId: sessionYearId, date: '2026-09-28', period: 1, status: 'absent', isVoided: false },
      { tenantId, studentId: STUDENT, classSectionId: sectionId, academicYearId: sessionYearId, date: friday, period: 1, status: 'absent', isVoided: false },
      { tenantId, studentId: STUDENT, classSectionId: sectionId, academicYearId: sessionYearId, date: monday, period: 1, status: 'absent', isVoided: false },
    ]);

    await detectAndRecordFlags(tenantId, STUDENT, monday, 'absent');

    const flags = await db.select({ type: attendanceFlags.type }).from(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));

    expect(flags.map(f => f.type)).toContain('CONSECUTIVE_ABSENCE');
  });

  it('G12.7: a date outside the academic session is rejected with DATE_OUTSIDE_SESSION', async () => {
    const res = await post({ date: outside, period: 2, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });

    expect(res.status).toBe(422);
    expect((await bodyOf(res)).error.code).toBe('DATE_OUTSIDE_SESSION');
  });

  it('G12.5: missing-register detection only applies inside the session and on timetable days', async () => {
    // 2026-10-12 is a mark-free Monday inside the session.
    const inSessionMonday = await bodyOf(await getAuditSummary(new Request('http://x/api/attendance/audit-summary?date=2026-10-12')));

    expect(inSessionMonday.data.missingRegistersToday.some((slot: { classSectionId: string }) => slot.classSectionId === sectionId)).toBe(true);

    // 2027-07-05 is a Monday but outside the session → never "missing".
    const outsideSession = await bodyOf(await getAuditSummary(new Request('http://x/api/attendance/audit-summary?date=2027-07-05')));

    expect(outsideSession.data.missingRegistersToday).toHaveLength(0);
  });

  it('G12.10: historical attendance on a now-classified non-instructional day stays untouched', async () => {
    const [historical] = await db.insert(attendance).values({
      tenantId,
      studentId: STUDENT,
      classSectionId: sectionId,
      academicYearId: sessionYearId,
      date: saturday,
      period: 3,
      status: 'present',
      isVoided: false,
    }).returning();

    // Guard-affected flows run for other dates; the Saturday row must survive.
    await post({ date: monday, period: 3, studentGroupId: sectionId, records: [{ studentId: STUDENT, status: 'present' }] });
    await detectAndRecordFlags(tenantId, STUDENT, saturday, 'present');

    const [after] = await db
      .select({ status: attendance.status, isVoided: attendance.isVoided })
      .from(attendance)
      .where(eq(attendance.id, historical!.id));

    expect(after!.status).toBe('present');
    expect(after!.isVoided).toBe(false);
  });
});
