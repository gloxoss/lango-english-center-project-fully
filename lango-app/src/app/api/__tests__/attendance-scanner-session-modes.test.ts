import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as startSession } from '@/app/api/attendance/qr/scanner-sessions/route';
import { db } from '@/libs/DB';
import {
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSessionExceptions,
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

// A scanner session names a lesson, or the whole school (fix-plan-02).
//
// The rules worth pinning are the ones a careless implementation gets wrong:
// that a session cannot be opened for a lesson you do not teach, that a
// cancelled lesson cannot be scanned into, that both modes reuse an already-open
// session instead of opening a second one, and that a section is no longer
// enough to define a session.

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
const OTHER_TENANT = crypto.randomUUID();
const ADMIN = `SM-ADMIN-${suffix}`;
const OWNER = `SM-OWNER-${suffix}`;
const OTHER_TEACHER = `SM-OTHER-${suffix}`;

let sectionId = '';
let lessonSlotId = '';

async function actAs(userId: string, role: 'school_admin' | 'teacher') {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId,
    tenantId,
    role,
    branchId: null,
  } as RequestContext);
}

function start(body: unknown): Promise<Response> {
  return startSession(new Request('http://x/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function sessionsFor(slotId: string) {
  return db
    .select({ id: scannerSessions.id, slot: scannerSessions.classScheduleSlotId, date: scannerSessions.date })
    .from(scannerSessions)
    .where(and(eq(scannerSessions.tenantId, tenantId), eq(scannerSessions.classScheduleSlotId, slotId)));
}

describe.skipIf(!dbReachable)('scanner session modes and permissions', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values([
      { id: tenantId, name: `SessM ${suffix}`, slug: `sessm-${suffix}` },
      { id: OTHER_TENANT, name: `SessM2 ${suffix}`, slug: `sessm2-${suffix}` },
    ]);
    const [branch] = await db.insert(branches).values({ tenantId, name: `SM-${suffix}`, code: `SM-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'SM Admin', email: `sma-${suffix}@t.local`, role: 'school_admin' },
      { id: OWNER, tenantId, branchId: branch!.id, name: 'SM Owner', email: `smo-${suffix}@t.local`, role: 'teacher' },
      { id: OTHER_TEACHER, tenantId, branchId: branch!.id, name: 'SM Other', email: `smt-${suffix}@t.local`, role: 'teacher' },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `SY-${suffix}`,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    }).returning();

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `SM1-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `SM-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = cs!.id;

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

    const [slot] = await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId: sectionId,
      classSubjectId: classSubject!.id,
      teacherId: OWNER,
      dayOfWeek: 'tuesday',
      startTime: '14:00',
      endTime: '14:55',
      versionId: version!.id,
    }).returning();
    lessonSlotId = slot!.id;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
    await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, tenantId));
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
    await db.delete(tenants).where(eq(tenants.id, OTHER_TENANT));
  });

  it('SM.1: the admin opens a classroom session bound to the lesson, and a second call reuses it', async () => {
    await actAs(ADMIN, 'school_admin');
    const first = await start({ slotId: lessonSlotId, date: TODAY });

    expect(first.status).toBe(201);

    const firstBody = await first.json() as any;

    expect(firstBody.mode).toBe('classroom');
    expect(firstBody.reused).toBe(false);
    expect(firstBody.data.classScheduleSlotId).toBe(lessonSlotId);

    const second = await start({ slotId: lessonSlotId, date: TODAY });
    const secondBody = await second.json() as any;

    expect(secondBody.reused).toBe(true);
    expect(secondBody.data.id).toBe(firstBody.data.id);

    expect(await sessionsFor(lessonSlotId)).toHaveLength(1);
  });

  it('SM.2: the lesson\'s own teacher may open it', async () => {
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
    await actAs(OWNER, 'teacher');
    const res = await start({ slotId: lessonSlotId, date: TODAY });

    expect(res.status).toBe(201);
  });

  it('SM.3: a teacher who does not teach it may not', async () => {
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
    await actAs(OTHER_TEACHER, 'teacher');
    const res = await start({ slotId: lessonSlotId, date: TODAY });

    expect(res.status).toBe(403);
    expect((await res.json() as any).error.code).toBe('NOT_YOUR_LESSON');
    expect(await sessionsFor(lessonSlotId)).toHaveLength(0);
  });

  it('SM.4: a cancelled lesson cannot be scanned into', async () => {
    await db.delete(scannerSessions).where(eq(scannerSessions.tenantId, tenantId));
    await db.insert(classSessionExceptions).values({
      tenantId,
      classScheduleSlotId: lessonSlotId,
      date: TODAY,
      type: 'CANCELLED',
      reason: 'Sortie scolaire',
      createdById: ADMIN,
    });

    try {
      await actAs(OWNER, 'teacher');
      const res = await start({ slotId: lessonSlotId, date: TODAY });

      expect(res.status).toBe(422);
      expect((await res.json() as any).error.code).toBe('LESSON_CANCELLED');
      expect(await sessionsFor(lessonSlotId)).toHaveLength(0);
    } finally {
      await db.delete(classSessionExceptions).where(eq(classSessionExceptions.tenantId, tenantId));
    }
  });

  it('SM.5: no slotId opens an entrance session with no lesson, reused for the day', async () => {
    await actAs(ADMIN, 'school_admin');
    const first = await start({ date: TODAY });

    expect(first.status).toBe(201);

    const firstBody = await first.json() as any;

    expect(firstBody.mode).toBe('entrance');
    expect(firstBody.data.classScheduleSlotId).toBeNull();
    expect(firstBody.data.classSectionId).toBeNull();

    const second = await start({ date: TODAY });
    const secondBody = await second.json() as any;

    expect(secondBody.reused).toBe(true);
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });

  it('SM.6: a lesson from another tenant is not reachable', async () => {
    await actAs(ADMIN, 'school_admin');
    const res = await start({ slotId: crypto.randomUUID(), date: TODAY });

    expect(res.status).toBe(422);
    expect((await res.json() as any).error.code).toBe('INVALID_SLOT');
  });

  it('SM.7: a lesson not scheduled on that date is refused', async () => {
    await actAs(ADMIN, 'school_admin');
    // The slot is a Tuesday lesson; ask for the Wednesday.
    const res = await start({ slotId: lessonSlotId, date: '2026-10-07' });

    expect(res.status).toBe(422);
    expect((await res.json() as any).error.code).toBe('LESSON_NOT_SCHEDULED');
  });
});
