import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AttendanceAdapter } from '@/addons/advanced-reporting/adapters/attendance-adapter';
import { GET as rosterGet } from '@/app/api/academics/classes/roster/route';
import { GET as summaryGet } from '@/app/api/attendance/summary/route';
import { GET as reminderAudienceGet } from '@/app/api/communication/reminder-audience/route';
import { GET as studentsGet } from '@/app/api/students/route';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  attendance,
  attendanceExcuses,
  attendanceSummary,
  branches,
  classes,
  classSections,
  guardians,
  guardianStudents,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// G14 CONSUMER CONVERGENCE — every attendance consumer derives from the same
// canonical eligible-mark truth: tenant + non-voided marks, late/excused count
// as attended, approved excuses reconcile unjustified absence at their exact
// scope, and a zero denominator is NULL — never a fabricated 100.

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
const ADMIN = `CONV-ADMIN-${tenantId}`;
const S1 = crypto.randomUUID(); // present+late+excused+absent (+voided) => 75%
const S2 = crypto.randomUUID(); // zero data => null
const S3 = crypto.randomUUID(); // 2 absences, 1 justified at scope => not at risk
const S4 = crypto.randomUUID(); // 2 absences, excuse out of scope => at risk
const today = casablancaTodayIso();
const prior = new Date(`${today}T12:00:00Z`);
prior.setUTCDate(prior.getUTCDate() - 1);
const priorDay = prior.toISOString().slice(0, 10);

let classId = '';
let sectionId = '';
let sessionYearId = '';

function get(url: string): Promise<Response> {
  return Promise.resolve().then(async () => {
    const route = url.startsWith('/api/academics/classes/roster')
      ? rosterGet
      : url.startsWith('/api/students')
        ? studentsGet
        : url.startsWith('/api/attendance/summary')
          ? summaryGet
          : reminderAudienceGet;
    return route(new Request(`http://x${url}`));
  });
}

describe.skipIf(!dbReachable)('G14 consumer convergence — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Conv ${suffix}`, slug: `conv-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `CV-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Conv Admin', email: `conv-admin-${suffix}@t.local`, role: 'school_admin' },
      { id: S1, tenantId, branchId: branch!.id, name: 'Conv S1', email: `conv-s1-${suffix}@t.local`, role: 'student' },
      { id: S2, tenantId, branchId: branch!.id, name: 'Conv S2', email: `conv-s2-${suffix}@t.local`, role: 'student' },
      { id: S3, tenantId, branchId: branch!.id, name: 'Conv S3', email: `conv-s3-${suffix}@t.local`, role: 'student' },
      { id: S4, tenantId, branchId: branch!.id, name: 'Conv S4', email: `conv-s4-${suffix}@t.local`, role: 'student' },
    ]);
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `CV1-${suffix}`, mediumId: medium!.id }).returning();
    classId = cls!.id;
    const [section] = await db.insert(sections).values({ tenantId, name: `A-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: section!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = cs!.id;
    await db.update(user).set({ classSectionId: sectionId }).where(eq(user.tenantId, tenantId));

    const [session] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      isDefault: true,
    }).returning();
    sessionYearId = session!.id;

    const mark = (studentId: string, date: string, status: 'present' | 'late' | 'absent' | 'excused', period = 1, isVoided = false) => ({
      tenantId,
      studentId,
      classSectionId: sectionId,
      academicYearId: sessionYearId,
      date,
      period,
      status,
      isVoided,
    });

    await db.insert(attendance).values([
      // S1: canonical presence = (present + late + excused) / 4 = 75%.
      mark(S1, today, 'present'),
      mark(S1, today, 'late', 2),
      mark(S1, priorDay, 'excused', 3),
      mark(S1, priorDay, 'absent', 4),
      // Voided rows are audit history — never counted.
      mark(S1, today, 'absent', 5, true),
      // S3: two absences, one covered by an approved date-level excuse.
      mark(S3, today, 'absent'),
      mark(S3, priorDay, 'absent'),
      // S4: two absences; the approved excuse only covers period 5 — the marks
      // are period 1, so the scope mismatch keeps them unjustified.
      mark(S4, today, 'absent'),
      mark(S4, priorDay, 'absent'),
    ]);

    await db.insert(attendanceExcuses).values([
      { tenantId, studentId: S3, classSectionId: sectionId, period: null, sessionYearId, date: priorDay, reason: 'certificat médical', status: 'approved' },
      { tenantId, studentId: S4, classSectionId: sectionId, period: 5, sessionYearId, date: priorDay, reason: 'certificat médical', status: 'approved' },
    ]);

    // Guardian links so S3/S4 are contactable in the reminder audience.
    const guardianRows = await db.insert(guardians).values([
      { tenantId, firstName: 'G', lastName: 'Three', phone: '0600000003', smsOptIn: true },
      { tenantId, firstName: 'G', lastName: 'Four', phone: '0600000004', smsOptIn: true },
    ]).returning();
    await db.insert(guardianStudents).values([
      { tenantId, guardianId: guardianRows[0]!.id, studentId: S3, relationshipType: 'parent', canAccessCommunication: true, status: 'active' },
      { tenantId, guardianId: guardianRows[1]!.id, studentId: S4, relationshipType: 'parent', canAccessCommunication: true, status: 'active' },
    ]);

    // Canonical summary cache for the batch-summary consumer.
    await recalculateStudentAttendanceSummary(tenantId, S1);
    await recalculateStudentAttendanceSummary(tenantId, S2);
  });

  afterAll(async () => {
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function asAdmin() {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({
      userId: ADMIN,
      tenantId,
      role: 'school_admin',
      branchId: null,
    } as RequestContext);
  }

  it('G14.13: class roster rate is canonical (late/excused attended) and voided-excluded', async () => {
    await asAdmin();
    const res = await get(`/api/academics/classes/roster?id=${classId}`);

    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const s1 = json.data.students.find((s: any) => s.id === S1);

    expect(s1.attendanceRate).toBe(50); // (present + late) / 4 — physical presence only
  });

  it('G14.14: roster zero-data is NULL, not 100', async () => {
    await asAdmin();
    const res = await get(`/api/academics/classes/roster?id=${classId}`);
    const json = await res.json() as any;
    const s2 = json.data.students.find((s: any) => s.id === S2);

    expect(s2.attendanceRate).toBeNull();
  });

  it('G14.15: Student 360 rate is canonical and voided rows never inflate the counts', async () => {
    await asAdmin();
    const res = await get(`/api/students?id=${S1}`);

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.attendance.rate).toBe(75);
    expect(json.data.attendance.recordedCount).toBe(4);
    expect(json.data.attendance.presentCount).toBe(1);
    expect(json.data.attendance.lateCount).toBe(1);
    expect(json.data.attendance.excusedCount).toBe(1);
    expect(json.data.attendance.absentCount).toBe(1);

    const zeroRes = await get(`/api/students?id=${S2}`);
    const zeroJson = await zeroRes.json() as any;

    expect(zeroJson.data.attendance.rate).toBeNull();
    expect(zeroJson.data.attendance.recordedCount).toBe(0);
  });

  it('G14.16: summary batch returns canonical cached rates (zero data -> NULL)', async () => {
    await asAdmin();
    const res = await get(`/api/attendance/summary?studentIds=${S1},${S2}`);

    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const s1 = json.data.find((r: any) => r.studentId === S1);
    const s2 = json.data.find((r: any) => r.studentId === S2);

    expect(Number(s1.attendanceRate)).toBe(50);
    expect(s1.totalSessions).toBe(4);
    expect(s2.attendanceRate).toBeNull();
    expect(s2.totalSessions).toBe(0);
  });

  it('G14.17: reminder audience reconciles approved excuses at exact scope', async () => {
    await asAdmin();
    const res = await get('/api/communication/reminder-audience?mode=atRisk&pageSize=100');

    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const ids = (json.data as any[]).map(r => r.studentId);

    // S3's second absence is justified at date level -> only 1 unjustified day.
    expect(ids).not.toContain(S3);
    // S4's excuse is scoped to period 5 while the marks are period 1 -> 2 days.
    expect(ids).toContain(S4);
  });

  it('G14.18: advanced-reporting overview is canonical (rate, unexcused, voided, zero data)', async () => {
    const overview = await AttendanceAdapter.getAttendanceOverviewReport(tenantId);
    const s1 = overview.find(o => o.studentName === 'Conv S1');

    expect(s1?.attendanceRate).toBe(50);
    expect(s1?.totalSessions).toBe(4);
    expect(s1?.unexcusedAbsences).toBe(1);

    const s2 = overview.find(o => o.studentName === 'Conv S2');

    expect(s2?.attendanceRate).toBeNull();
    expect(s2?.riskAlertLevel).toBe('À configurer');

    const s3 = overview.find(o => o.studentName === 'Conv S3');

    expect(s3?.unexcusedAbsences).toBe(1); // priorDay justified at scope

    const s4 = overview.find(o => o.studentName === 'Conv S4');

    expect(s4?.unexcusedAbsences).toBe(2); // excuse scope mismatch
  });
});
