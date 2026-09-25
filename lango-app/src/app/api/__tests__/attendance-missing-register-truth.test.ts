import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as auditSummary } from '@/app/api/attendance/audit-summary/route';
import { db } from '@/libs/DB';
import {
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// P1 missing-register truth. The rule previously counted a lesson that had not
// happened yet, used the UTC date, and read slots from every timetable version
// including drafts.

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

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/features/broadcast/services/sms-delivery', () => ({ sendSmsMessage: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `MR-ADMIN-${suffix}`;
const TEACHER = `MR-TEACHER-${suffix}`;

// 13:00 in Casablanca (UTC+1 in October) on a Tuesday.
const FROZEN_NOW = new Date('2026-10-06T12:00:00.000Z');
const TODAY = '2026-10-06';

let publishedVersionId = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN,
    tenantId,
    role: 'school_admin',
    branchId: null,
  } as RequestContext);
}

describe.skipIf(!dbReachable)('missing-register truth — DB-backed', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `MissReg ${suffix}`, slug: `miss-reg-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus ${suffix}`, code: `MR-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'MR Admin', email: `mr-ad-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER, tenantId, branchId: branch!.id, name: 'MR Teacher', email: `mr-te-${suffix}@t.local`, role: 'teacher' },
    ]);

    await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    });

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `MR1-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `MR-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({
      tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30,
    }).returning();
    const [subject] = await db.insert(subjects).values({ tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({
      tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory',
    }).returning();

    const versions = await db.insert(timetableVersions).values([
      { tenantId, sessionYearId: (await db.select({ id: sessionYears.id }).from(sessionYears).where(eq(sessionYears.tenantId, tenantId)).limit(1))[0]!.id, status: 'published', versionNumber: 1, effectiveFrom: '2026-09-01', effectiveTo: '2027-06-30', createdBy: ADMIN },
      { tenantId, sessionYearId: (await db.select({ id: sessionYears.id }).from(sessionYears).where(eq(sessionYears.tenantId, tenantId)).limit(1))[0]!.id, status: 'draft', versionNumber: 2, effectiveFrom: '2026-09-01', effectiveTo: '2027-06-30', createdBy: ADMIN },
    ]).returning();

    publishedVersionId = versions[0]!.id;
    const draftVersionId = versions[1]!.id;

    await db.insert(classScheduleSlots).values([
      // Ended at 09:00, well before 13:00 — a register is genuinely missing.
      { tenantId, classSectionId: cs!.id, classSubjectId: classSubject!.id, teacherId: TEACHER, dayOfWeek: 'tuesday', startTime: '08:00', endTime: '09:00', versionId: publishedVersionId },
      // Still to come at 13:00 — must never be reported missing.
      { tenantId, classSectionId: cs!.id, classSubjectId: classSubject!.id, teacherId: TEACHER, dayOfWeek: 'tuesday', startTime: '15:00', endTime: '16:00', versionId: publishedVersionId },
      // Ended, but belongs to a DRAFT version — not an expectation.
      { tenantId, classSectionId: cs!.id, classSubjectId: classSubject!.id, teacherId: TEACHER, dayOfWeek: 'tuesday', startTime: '07:00', endTime: '07:30', versionId: draftVersionId },
    ]);
  });

  afterAll(async () => {
    vi.useRealTimers();
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
    void publishedVersionId;
  });

  async function missing() {
    await asAdmin();
    const res = await auditSummary(new Request(`http://x/api/attendance/audit-summary?date=${TODAY}`));
    const json = await res.json() as any;
    return json.data.missingRegistersToday as { startTime: string; endTime: string }[];
  }

  it('MR.1: a lesson that has not ended yet is never reported missing', async () => {
    const rows = await missing();

    expect(rows.some(r => r.startTime === '15:00')).toBe(false);
  });

  it('MR.2: an ended lesson with no register is reported missing', async () => {
    const rows = await missing();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.startTime).toBe('08:00');
    expect(rows[0]!.endTime).toBe('09:00');
  });

  it('MR.3: slots from a draft timetable version are not expectations', async () => {
    const rows = await missing();

    expect(rows.some(r => r.startTime === '07:00')).toBe(false);
  });
});
