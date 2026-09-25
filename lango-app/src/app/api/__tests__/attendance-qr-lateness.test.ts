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

// Phase 7: lateness is relative to the ACTUAL lesson, not one school-wide start
// time. The clock is identical in both cases below — only the timetable differs,
// which is the whole point. Before this, both scans were judged against 08:00.
const FROZEN_NOW = new Date('2026-10-06T06:30:00.000Z'); // 07:30 Casablanca, Tuesday
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

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `LATE-ADMIN-${suffix}`;
const EARLY_STUDENT = crypto.randomUUID();
const LATE_STUDENT = crypto.randomUUID();
const EARLY_TOKEN = `tok-early-${crypto.randomUUID()}`;
const LATE_TOKEN = `tok-late-${crypto.randomUUID()}`;

let earlySection = '';
let lateSection = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN, tenantId, role: 'school_admin', branchId: null,
  } as RequestContext);
}

function scan(body: unknown): Promise<Response> {
  return verifyAndStage(new Request('http://x/api/attendance/qr/verify-and-stage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe.skipIf(!dbReachable)('QR lateness relative to the session — DB-backed', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `Late ${suffix}`, slug: `late-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `L-${suffix}`, code: `L-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'Late Admin', email: `la-${suffix}@t.local`, role: 'school_admin' },
      { id: EARLY_STUDENT, tenantId, branchId: branch!.id, name: 'Early Student', email: `es-${suffix}@t.local`, role: 'student' },
      { id: LATE_STUDENT, tenantId, branchId: branch!.id, name: 'Late Student', email: `ls-${suffix}@t.local`, role: 'student' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId, name: `SY-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true,
    }).returning();

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `L1-${suffix}`, mediumId: medium!.id }).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `EA-${suffix}` },
      { tenantId, name: `LA-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: cls!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: cls!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();

    earlySection = csRows[0]!.id;
    lateSection = csRows[1]!.id;

    await db.update(user).set({ classSectionId: earlySection }).where(eq(user.id, EARLY_STUDENT));
    await db.update(user).set({ classSectionId: lateSection }).where(eq(user.id, LATE_STUDENT));

    const [subject] = await db.insert(subjects).values({ tenantId, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

    const [version] = await db.insert(timetableVersions).values({
      tenantId, sessionYearId: sessionYear!.id, status: 'published', versionNumber: 1,
      effectiveFrom: '2026-09-01', effectiveTo: '2027-06-30', createdBy: ADMIN,
    }).returning();

    // Two lessons, same day, DIFFERENT start times. The scan happens at 07:30.
    await db.insert(classScheduleSlots).values([
      // Starts 07:00. With 15 min grace the threshold is 07:15, so 07:30 is LATE.
      { tenantId, classSectionId: earlySection, classSubjectId: classSubject!.id, teacherId: ADMIN, dayOfWeek: 'tuesday', startTime: '07:00', endTime: '07:55', versionId: version!.id },
      // Starts 08:00. Threshold 08:15, so the SAME 07:30 scan is ON TIME.
      { tenantId, classSectionId: lateSection, classSubjectId: classSubject!.id, teacherId: ADMIN, dayOfWeek: 'tuesday', startTime: '08:00', endTime: '08:55', versionId: version!.id },
    ]);

    await db.insert(identityBadgeCredentials).values([
      { tenantId, userId: EARLY_STUDENT, tokenHash: computeHmacHash(EARLY_TOKEN), status: 'active' },
      { tenantId, userId: LATE_STUDENT, tokenHash: computeHmacHash(LATE_TOKEN), status: 'active' },
    ]);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
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

  async function stagedStatusFor(studentId: string) {
    const [row] = await db
      .select({ status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId), eq(attendance.date, TODAY)));
    return row?.status;
  }

  it('L7.1: the same clock is LATE for a lesson that started at 07:00', async () => {
    await asAdmin();
    const res = await scan({ rawToken: EARLY_TOKEN, classSectionId: earlySection, period: 1 });

    expect(res.status).toBe(200);
    expect(await stagedStatusFor(EARLY_STUDENT)).toBe('late');
  });

  it('L7.2: and ON TIME for a lesson that starts at 08:00 — the timetable decides, not a global 08:00', async () => {
    await asAdmin();
    const res = await scan({ rawToken: LATE_TOKEN, classSectionId: lateSection, period: 1 });

    expect(res.status).toBe(200);

    // Before phase 7 both scans were judged against attendance.periodStartTime
    // (default 08:00 + grace), so this one would also have been "present" only
    // by coincidence — and an afternoon lesson could never be on time.
    expect(await stagedStatusFor(LATE_STUDENT)).toBe('present');
  });
});
