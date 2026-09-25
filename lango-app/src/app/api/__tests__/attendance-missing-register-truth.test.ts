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

// P1 missing-register truth: the selected date is classified against the
// Casablanca business day BEFORE any clock comparison.
//   past date   -> every lesson of that day has ended
//   today       -> only lessons whose end time has passed are overdue
//   future date -> nothing is overdue; a schedule preview only
// Plus: only a PUBLISHED, EFFECTIVE timetable version creates expectations.
//
// KNOWN LIMITATION (deferred to phase 1): this rule is still SECTION-level, so
// one marked period hides another unmarked lesson in the same section.
//
// Two tenants are used because the schema enforces a single published version
// per (tenant, session year) via timetable_versions_single_published_idx, so a
// "published but no longer effective" version cannot coexist with the governing
// one in the same year.

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

// 13:00 Casablanca (UTC+1 in October) on a Tuesday.
const FROZEN_NOW = new Date('2026-10-06T12:00:00.000Z');
const TODAY = '2026-10-06';          // Tuesday
const PAST_TUESDAY = '2026-09-29';   // Tuesday, earlier in the same session
const FUTURE_TUESDAY = '2026-10-13'; // Tuesday, later in the same session
const WEDNESDAY = '2026-10-07';

type Fixture = {
  tenantId: string;
  adminId: string;
  sectionId: string;
  publishedVersionId: string | null;
};

async function provision(name: string, publishedWindow: { from: string; to: string } | null): Promise<Fixture> {
  const tid = crypto.randomUUID();
  const adminId = `MR-A-${tid}`;
  const teacherId = `MR-T-${tid}`;

  await db.insert(tenants).values({ id: tid, name: `${name}-${suffix}`, slug: `${name}-${suffix}` });
  const [branch] = await db.insert(branches).values({ tenantId: tid, name: `C-${suffix}`, code: `${name}-${suffix}`.slice(0, 40) }).returning();
  await db.insert(user).values([
    { id: adminId, tenantId: tid, branchId: branch!.id, name: 'MR Admin', email: `${adminId}@t.local`, role: 'school_admin' },
    { id: teacherId, tenantId: tid, branchId: branch!.id, name: 'MR Teacher', email: `${teacherId}@t.local`, role: 'teacher' },
  ]);
  const [sessionYear] = await db.insert(sessionYears).values({
    tenantId: tid, name: `SY-${name}-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true,
  }).returning();
  const [medium] = await db.insert(mediums).values({ tenantId: tid, name: `FR-${suffix}` }).returning();
  const [cls] = await db.insert(classes).values({ tenantId: tid, branchId: branch!.id, name: `C1-${suffix}`, mediumId: medium!.id }).returning();
  const [label] = await db.insert(sections).values({ tenantId: tid, name: `S-${suffix}` }).returning();
  const [cs] = await db.insert(classSections).values({ tenantId: tid, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
  const [subject] = await db.insert(subjects).values({ tenantId: tid, name: `M-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
  const [classSubject] = await db.insert(classSubjects).values({ tenantId: tid, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

  const published = publishedWindow
    ? (await db.insert(timetableVersions).values({
        tenantId: tid, sessionYearId: sessionYear!.id, status: 'published', versionNumber: 1,
        effectiveFrom: publishedWindow.from, effectiveTo: publishedWindow.to, createdBy: adminId,
      }).returning())[0]!
    : null;

  const [draft] = await db.insert(timetableVersions).values({
    tenantId: tid, sessionYearId: sessionYear!.id, status: 'draft', versionNumber: 9,
    effectiveFrom: '2026-09-01', effectiveTo: '2027-06-30', createdBy: adminId,
  }).returning();

  const base = { tenantId: tid, classSectionId: cs!.id, classSubjectId: classSubject!.id, teacherId };

  if (published) {
    await db.insert(classScheduleSlots).values([
      { ...base, dayOfWeek: 'tuesday', startTime: '08:00', endTime: '09:00', versionId: published.id },
      { ...base, dayOfWeek: 'tuesday', startTime: '12:30', endTime: '13:30', versionId: published.id },
      { ...base, dayOfWeek: 'tuesday', startTime: '15:00', endTime: '16:00', versionId: published.id },
      { ...base, dayOfWeek: 'wednesday', startTime: '00:15', endTime: '00:20', versionId: published.id },
    ]);
  }

  // A draft-version slot exists in every tenant: it must never be an expectation.
  await db.insert(classScheduleSlots).values({
    ...base, dayOfWeek: 'tuesday', startTime: '10:00', endTime: '11:00', versionId: draft!.id,
  });

  return { tenantId: tid, adminId, sectionId: cs!.id, publishedVersionId: published?.id ?? null };
}

async function asAdmin(f: Fixture) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: f.adminId, tenantId: f.tenantId, role: 'school_admin', branchId: null,
  } as RequestContext);
}

describe.skipIf(!dbReachable)('missing-register truth — DB-backed', () => {
  let main: Fixture;
  let stale: Fixture;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);
    // Governing version covers the whole session.
    main = await provision('mr-main', { from: '2026-09-01', to: '2027-06-30' });
    // Published, but its effectiveness ended before every audited date.
    stale = await provision('mr-stale', { from: '2026-01-01', to: '2026-06-30' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const f of [main, stale]) {
      await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, f.tenantId));
      await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, f.tenantId));
      await db.delete(classSubjects).where(eq(classSubjects.tenantId, f.tenantId));
      await db.delete(subjects).where(eq(subjects.tenantId, f.tenantId));
      await db.delete(classSections).where(eq(classSections.tenantId, f.tenantId));
      await db.delete(classes).where(eq(classes.tenantId, f.tenantId));
      await db.delete(sections).where(eq(sections.tenantId, f.tenantId));
      await db.delete(mediums).where(eq(mediums.tenantId, f.tenantId));
      await db.delete(sessionYears).where(eq(sessionYears.tenantId, f.tenantId));
      await db.delete(user).where(eq(user.tenantId, f.tenantId));
      await db.delete(branches).where(eq(branches.tenantId, f.tenantId));
      await db.delete(tenants).where(eq(tenants.id, f.tenantId));
    }
  });

  /** Start times of the slots reported missing for `date`, sorted. */
  async function missingAt(f: Fixture, date: string): Promise<string[]> {
    await asAdmin(f);
    const res = await auditSummary(new Request(`http://x/api/attendance/audit-summary?date=${date}`));
    const json = await res.json() as any;
    return (json.data.missingRegistersToday as { startTime: string }[])
      .map(r => r.startTime)
      .sort();
  }

  // ---- past date -----------------------------------------------------------

  it('MR.1: on a PAST date every lesson counts as ended, whatever the clock says', async () => {
    // The frozen clock is 13:00: B and C would NOT be overdue today, but on a
    // past date the whole day is over, so all three are missing.
    expect(await missingAt(main, PAST_TUESDAY)).toEqual(['08:00', '12:30', '15:00']);
  });

  it('MR.2: a past date reports the morning and the afternoon lesson alike', async () => {
    const rows = await missingAt(main, PAST_TUESDAY);

    expect(rows).toContain('08:00'); // morning
    expect(rows).toContain('15:00'); // afternoon
  });

  // ---- today ---------------------------------------------------------------

  it('MR.3: today, an ongoing lesson is NOT missing', async () => {
    expect(await missingAt(main, TODAY)).not.toContain('12:30'); // 12:30-13:30 straddles 13:00
  });

  it('MR.4: today, a lesson that has not started is NOT missing', async () => {
    expect(await missingAt(main, TODAY)).not.toContain('15:00');
  });

  it('MR.5: today, an ended lesson with no register IS missing', async () => {
    expect(await missingAt(main, TODAY)).toEqual(['08:00']);
  });

  // ---- future date ---------------------------------------------------------

  it('MR.6: a FUTURE date is a preview only — nothing is missing', async () => {
    expect(await missingAt(main, FUTURE_TUESDAY)).toEqual([]);
  });

  // ---- timetable version ---------------------------------------------------

  it('MR.7: slots from a draft version are never expectations', async () => {
    expect(await missingAt(main, PAST_TUESDAY)).not.toContain('10:00');
    expect(await missingAt(main, TODAY)).not.toContain('10:00');
  });

  it('MR.8: slots from a published but NON-EFFECTIVE version are never expectations', async () => {
    // This tenant's only published version stopped being effective on 2026-06-30,
    // so it governs none of the audited dates and yields no expectation at all.
    expect(await missingAt(stale, TODAY)).toEqual([]);
    expect(await missingAt(stale, PAST_TUESDAY)).toEqual([]);
  });

  it('MR.9: the effective published version IS considered', async () => {
    expect(await missingAt(main, TODAY)).toContain('08:00');
  });

  // ---- Casablanca boundary -------------------------------------------------

  it('MR.10: the business date is Casablanca, not UTC', async () => {
    // 23:30 UTC on the 6th is already 00:30 on the 7th in Casablanca. Under UTC
    // date semantics the 7th is a FUTURE date and nothing is reported; under
    // Casablanca semantics it is TODAY and the 00:15 lesson has already ended.
    // This is the case where the two readings disagree.
    vi.setSystemTime(new Date('2026-10-06T23:30:00.000Z'));
    try {
      expect(await missingAt(main, WEDNESDAY)).toEqual(['00:15']);
    } finally {
      vi.setSystemTime(FROZEN_NOW);
    }
  });
});
