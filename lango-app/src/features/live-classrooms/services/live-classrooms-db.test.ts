// DB-backed integration tests for the live-classrooms lifecycle.
//
// Covers the EXECUTION-PLAN authorization/security list with a real Postgres:
//  - cross-tenant class / teacher / student / provider-config IDs
//  - student from another class; unassigned teacher (+ admin override)
//  - session overlap (LIVE_SESSION_CONFLICT); teacher detail scope
//  - join before window / after end / cancelled classroom / replay
//  - forged & duplicate webhooks (receipt recorded, event ingested once)
//  - concurrent start (single transition), start/end idempotency
//
// Skipped automatically unless DATABASE_URL is set (migrations 0081 must be
// applied). The dev provider proves internal behavior only — no network.
import { and, desc, eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  academicClassOfferings, classSections, classScheduleSlots, classSubjects, classes,
  guardianStudents, guardians, liveClassInvitations, liveClassJoinGrants,
  liveClassParticipantEvents, liveClassProviderOperations, liveClassProviderProfiles,
  liveClassSessions, liveClassWebhookReceipts, mediums, sections, sessionYears,
  studentPlacements, subjectTeachers, subjects, tenants, user,
} from '@/models/Schema';
import type { LiveClassPolicy } from '@/features/live-classrooms/models/live-classrooms-schema';
import { setProviderOverrideForTest } from '@/features/live-classrooms/providers';
import {
  cancelLiveSession, createLiveSession, endLiveSession, expireStaleSessions, getSessionDetail,
  loadSession, resetProviderOpTimeoutForTest, setProviderOpTimeoutForTest, startLiveSession,
  updateLiveSession, type CreateLiveSessionInput,
} from './session-service';
import { issueJoinGrant, redeemJoinGrant } from './join-service';
import { ingestWebhook } from './event-service';
import {
  cancelRoomCalls, clearScripts, createRoomCalls, roomIdCount, scriptedProvider,
  setCreateScript, setDefaultCreateScript,
} from '@/features/live-classrooms/providers/scripted-provider';

const hasDb = Boolean(process.env.DATABASE_URL);
const DEV_WEBHOOK_SECRET = 'dev-webhook-secret-do-not-use-in-prod';

function ctx(userId: string, tenantId: string, role: RequestContext['role'] = 'school_admin'): RequestContext {
  return { userId, tenantId, branchId: null, role, baseRole: role, name: 'Test User', email: `${userId}@test.local` };
}

// The DB stores timestamp(mode:'string') as naive LOCAL time (the create form
// sends datetime-local values). Format the same way so window comparisons in
// the services (new Date(scheduledStart).getTime()) line up with Date.now().
function localIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const policy: LiveClassPolicy = {
  recordingEnabled: true, waitingRoom: false, chat: true, screenShare: true,
  guestPolicy: 'deny', maxParticipants: null,
};

describe.skipIf(!hasDb)('live-classrooms DB lifecycle & tenant isolation', () => {
  const suffix = Date.now();
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const ids = {
    adminA: `LC-ADMIN-A-${suffix}`,
    adminB: `LC-ADMIN-B-${suffix}`,
    tA1: `LC-T-A1-${suffix}`,
    tA2: `LC-T-A2-${suffix}`,
    tA3: `LC-T-A3-${suffix}`,
    sA: `LC-S-A-${suffix}`,
    sA2: `LC-S-A2-${suffix}`,
    tB1: `LC-T-B1-${suffix}`,
  } as const;

  const MIN = 60_000;
  const HOUR = 3_600_000;
  const now = Date.now();
  const at = (ms: number) => localIso(new Date(now + ms));
  const W = {
    open: [at(-5 * MIN), at(HOUR)],
    future1: [at(2 * HOUR), at(3 * HOUR)],
    future2: [at(4 * HOUR), at(5 * HOUR)],
    past: [at(-3 * HOUR), at(-2 * HOUR)],
    life: [at(-30 * MIN), at(2 * HOUR)],
    cancel: [at(6 * HOUR), at(7 * HOUR)],
    start: [at(8 * HOUR), at(9 * HOUR)],
    conf: [at(10 * HOUR), at(11 * HOUR)],
    override: [at(12 * HOUR), at(13 * HOUR)],
    expirePast: [at(-3 * HOUR), at(-2 * HOUR)],
    expireFuture: [at(14 * HOUR), at(15 * HOUR)],
  } as const;

  let ref = {
    profileA: '' as string,
    profileB: '' as string,
    sectionA1: '' as string,
    sectionA2: '' as string,
    sectionB: '' as string,
    classSubjectA1: '' as string,
    classSubjectA2: '' as string,
    classSubjectB: '' as string,
    openSessionId: '' as string,
    openMeetingId: '' as string,
  };

  function baseInput(overrides: Partial<CreateLiveSessionInput> = {}): CreateLiveSessionInput {
    return {
      providerProfileId: ref.profileA,
      classSectionId: ref.sectionA1,
      classSubjectId: ref.classSubjectA1,
      teacherUserId: ids.tA1,
      title: 'Session de test',
      scheduledStart: W.open[0]!,
      scheduledEnd: W.open[1]!,
      policy,
      ...overrides,
    };
  }

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: 'Live A', slug: `live-a-${suffix}` },
      { id: tenantB, name: 'Live B', slug: `live-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: ids.adminA, tenantId: tenantA, name: 'Admin A', email: `lc-admin-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: ids.adminB, tenantId: tenantB, name: 'Admin B', email: `lc-admin-b-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: ids.tA1, tenantId: tenantA, name: 'Prof A1', email: `lc-ta1-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: ids.tA2, tenantId: tenantA, name: 'Prof A2', email: `lc-ta2-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: ids.tA3, tenantId: tenantA, name: 'Prof A3', email: `lc-ta3-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: ids.sA, tenantId: tenantA, name: 'Eleve A', email: `lc-sa-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: ids.sA2, tenantId: tenantA, name: 'Eleve A2', email: `lc-sa2-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: ids.tB1, tenantId: tenantB, name: 'Prof B1', email: `lc-tb1-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
    ]);

    // Academic backbone, tenant A: one class, two sections/subjects.
    const [mediumA] = await db.insert(mediums).values({ tenantId: tenantA, name: `Medium ${suffix}` }).returning();
    const mediumAId = mediumA!.id;
    const [classA] = await db.insert(classes).values({ tenantId: tenantA, name: `Classe ${suffix}`, mediumId: mediumAId }).returning();
    const classAId = classA!.id;
    const [secA1] = await db.insert(sections).values({ tenantId: tenantA, name: `S1-${suffix}` }).returning();
    const [secA2] = await db.insert(sections).values({ tenantId: tenantA, name: `S2-${suffix}` }).returning();
    const [subjA] = await db.insert(subjects).values({ tenantId: tenantA, name: `Anglais ${suffix}`, mediumId: mediumAId, type: 'theory' }).returning();
    const subjectAId = subjA!.id;

    const [csA1] = await db.insert(classSections).values({
      tenantId: tenantA, classId: classAId, sectionId: secA1!.id, mediumId: mediumAId,
    }).returning();
    const [csA2] = await db.insert(classSections).values({
      tenantId: tenantA, classId: classAId, sectionId: secA2!.id, mediumId: mediumAId,
    }).returning();
    const [csubA1] = await db.insert(classSubjects).values({
      tenantId: tenantA, classId: classAId, subjectId: subjectAId, type: 'compulsory',
    }).returning();
    const [csubA2] = await db.insert(classSubjects).values({
      tenantId: tenantA, classId: classAId, subjectId: subjectAId, type: 'compulsory',
    }).returning();

    await db.insert(subjectTeachers).values([
      { tenantId: tenantA, classSectionId: csA1!.id, subjectId: subjectAId, classSubjectId: csubA1!.id, teacherId: ids.tA1 },
      { tenantId: tenantA, classSectionId: csA2!.id, subjectId: subjectAId, classSubjectId: csubA2!.id, teacherId: ids.tA2 },
    ]);

    // Tenant B backbone for cross-tenant ID tests.
    const [mediumB] = await db.insert(mediums).values({ tenantId: tenantB, name: `Medium B ${suffix}` }).returning();
    const mediumBId = mediumB!.id;
    const [classB] = await db.insert(classes).values({ tenantId: tenantB, name: `Classe B ${suffix}`, mediumId: mediumBId }).returning();
    const classBId = classB!.id;
    const [secB] = await db.insert(sections).values({ tenantId: tenantB, name: `SB-${suffix}` }).returning();
    const [subjB] = await db.insert(subjects).values({ tenantId: tenantB, name: `Anglais B ${suffix}`, mediumId: mediumBId, type: 'theory' }).returning();
    const subjectBId = subjB!.id;
    const [csB] = await db.insert(classSections).values({
      tenantId: tenantB, classId: classBId, sectionId: secB!.id, mediumId: mediumBId,
    }).returning();
    const [csubB] = await db.insert(classSubjects).values({
      tenantId: tenantB, classId: classBId, subjectId: subjectBId, type: 'compulsory',
    }).returning();

    // Enabled dev provider profiles for both tenants.
    const [profileA] = await db.insert(liveClassProviderProfiles).values({
      tenantId: tenantA, name: 'Dev A', providerType: 'dev', scope: 'tenant', capabilities: [], enabled: true,
    }).returning();
    const [profileB] = await db.insert(liveClassProviderProfiles).values({
      tenantId: tenantB, name: 'Dev B', providerType: 'dev', scope: 'tenant', capabilities: [], enabled: true,
    }).returning();

    ref = {
      profileA: profileA!.id,
      profileB: profileB!.id,
      sectionA1: csA1!.id,
      sectionA2: csA2!.id,
      sectionB: csB!.id,
      classSubjectA1: csubA1!.id,
      classSubjectA2: csubA2!.id,
      classSubjectB: csubB!.id,
      openSessionId: '',
      openMeetingId: '',
    };

    // Shared "open now" session (teacher A1, section A1) used by join/webhook/redeem/scope tests.
    const open = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput());
    ref.openSessionId = open.id;
    ref.openMeetingId = open.providerMeetingId!;
  }, 60_000);

  afterAll(async () => {
    // Child-first so restrict FKs (session→user, session→profile) never block.
    // Both tenants: the P1-2 cross-tenant overlap test inserts a tenantB session.
    await db.delete(liveClassSessions).where(eq(liveClassSessions.tenantId, tenantA));
    await db.delete(liveClassSessions).where(eq(liveClassSessions.tenantId, tenantB));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantA));
    // guardians.userId -> user.id has no ON DELETE cascade: drop guardian rows
    // (P1-3 fixtures) before the blanket user delete below.
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantA));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  it('creates a scheduled session with a deterministic dev room', async () => {
    expect(ref.openSessionId).toBeTruthy();
    const detail = await getSessionDetail(tenantA, ref.openSessionId);
    expect(detail.session.status).toBe('scheduled');
    expect(ref.openMeetingId).toBe(`dev-${ref.openSessionId}`);
  });

  describe('tenant isolation', () => {
    it('rejects a cross-tenant session read with 404', async () => {
      await expect(getSessionDetail(tenantB, ref.openSessionId)).rejects.toMatchObject({ status: 404 });
    });

    it('rejects cross-tenant section / subject / teacher / provider-profile ids with 422', async () => {
      const cases = [
        { classSectionId: ref.sectionB },
        { classSubjectId: ref.classSubjectB },
        { teacherUserId: ids.tB1 },
        { providerProfileId: ref.profileB },
      ] as const;
      for (const overrides of cases) {
        await expect(createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({ ...overrides, scheduledStart: W.override[0]!, scheduledEnd: W.override[1]! })))
          .rejects.toMatchObject({ status: 422, code: 'INVALID_REFERENCE' });
      }
    });

    it('scopes a teacher detail read to their own sessions', async () => {
      await expect(getSessionDetail(tenantA, ref.openSessionId, { actorRole: 'teacher', actorUserId: ids.tA2 }))
        .rejects.toMatchObject({ status: 403, code: 'TEACHER_SCOPE' });
      await expect(getSessionDetail(tenantA, ref.openSessionId, { actorRole: 'teacher', actorUserId: ids.tA1 }))
        .resolves.toMatchObject({ session: { id: ref.openSessionId } });
    });

    // P1-11: classOfferingId / sourceTimetableSlotId are single-column FKs (the
    // referenced tables live outside this feature) — Postgres alone cannot tell
    // whether the id belongs to THIS tenant, only that it exists somewhere. The
    // app-layer preflight in assertTenantScopedOptionalRefs must catch a
    // cross-tenant id before it is ever written.
    describe('composite-tenant FK hardening (P1-11)', () => {
      let offeringA = '';
      let offeringB = '';
      let slotA = '';
      let slotB = '';

      beforeAll(async () => {
        const [syA] = await db.insert(sessionYears).values({
          tenantId: tenantA, name: `SY-A-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30',
        }).returning();
        const [syB] = await db.insert(sessionYears).values({
          tenantId: tenantB, name: `SY-B-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30',
        }).returning();
        // academic_class_offerings.section_id references the plain `sections`
        // table (not class_sections) — mint dedicated rows for this fixture.
        const [secOffA] = await db.insert(sections).values({ tenantId: tenantA, name: `OFF-A-${suffix}` }).returning();
        const [secOffB] = await db.insert(sections).values({ tenantId: tenantB, name: `OFF-B-${suffix}` }).returning();
        const classIdA = (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, ref.sectionA1)).limit(1))[0]!.classId;
        const classIdB = (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, ref.sectionB)).limit(1))[0]!.classId;
        const [offA] = await db.insert(academicClassOfferings).values({
          tenantId: tenantA, sessionYearId: syA!.id, classId: classIdA, sectionId: secOffA!.id,
        }).returning();
        const [offB] = await db.insert(academicClassOfferings).values({
          tenantId: tenantB, sessionYearId: syB!.id, classId: classIdB, sectionId: secOffB!.id,
        }).returning();
        offeringA = offA!.id;
        offeringB = offB!.id;

        const [slA] = await db.insert(classScheduleSlots).values({
          tenantId: tenantA, classSectionId: ref.sectionA1, classSubjectId: ref.classSubjectA1,
          teacherId: ids.tA1, dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00',
        }).returning();
        const [slB] = await db.insert(classScheduleSlots).values({
          tenantId: tenantB, classSectionId: ref.sectionB, classSubjectId: ref.classSubjectB,
          teacherId: ids.tB1, dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00',
        }).returning();
        slotA = slA!.id;
        slotB = slB!.id;
      });

      // Distinct future windows (60h+) so these never collide with the
      // schedule-overlap block (40-52h) or the provider-saga block (20-30h).
      it('accepts a same-tenant classOfferingId / sourceTimetableSlotId', async () => {
        const session = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
          classOfferingId: offeringA, sourceTimetableSlotId: slotA,
          scheduledStart: at(60 * HOUR), scheduledEnd: at(61 * HOUR),
        }));
        expect(session.classOfferingId).toBe(offeringA);
        expect(session.sourceTimetableSlotId).toBe(slotA);
      });

      it('rejects a cross-tenant classOfferingId with 422 INVALID_REFERENCE', async () => {
        await expect(createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
          classOfferingId: offeringB, scheduledStart: at(61 * HOUR), scheduledEnd: at(62 * HOUR),
        }))).rejects.toMatchObject({ status: 422, code: 'INVALID_REFERENCE' });
      });

      it('rejects a cross-tenant sourceTimetableSlotId with 422 INVALID_REFERENCE', async () => {
        await expect(createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
          sourceTimetableSlotId: slotB, scheduledStart: at(62 * HOUR), scheduledEnd: at(63 * HOUR),
        }))).rejects.toMatchObject({ status: 422, code: 'INVALID_REFERENCE' });
      });

      it('rejects the same cross-tenant refs on update', async () => {
        const session = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
          scheduledStart: at(63 * HOUR), scheduledEnd: at(64 * HOUR),
        }));
        await expect(updateLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id, { classOfferingId: offeringB }))
          .rejects.toMatchObject({ status: 422, code: 'INVALID_REFERENCE' });
      });
    });
  });

  describe('assignment & overlap', () => {
    it('rejects an unassigned teacher, admin override allows it', async () => {
      const input = baseInput({ teacherUserId: ids.tA3, scheduledStart: W.override[0]!, scheduledEnd: W.override[1]! });
      await expect(createLiveSession(ctx(ids.adminA, tenantA), tenantA, input))
        .rejects.toMatchObject({ status: 422, code: 'TEACHER_NOT_ASSIGNED' });

      const allowed = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...input, adminOverrideReason: 'Remplacement urgent',
      });
      expect(allowed.status).toBe('scheduled');
    });

    it('rejects an overlapping session for the same teacher', async () => {
      await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.conf[0]!, scheduledEnd: W.conf[1]!,
      }));
      await expect(createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: localIso(new Date(Date.parse(W.conf[0]!) + 15 * MIN)),
        scheduledEnd: localIso(new Date(Date.parse(W.conf[1]!) + 15 * MIN)),
      }))).rejects.toMatchObject({ status: 409, code: 'LIVE_SESSION_CONFLICT' });
    });
  });

  // P1-2: the EXCLUDE constraints from migration 0091 make overlap protection
  // DB-authoritative. These tests insert through the raw ORM (bypassing the
  // service pre-check on purpose) to prove the database itself rejects
  // conflicting rows with SQLSTATE 23P01, plus service-level behavior for the
  // friendly 409 path. Windows 40-51h are distinct from every other test block.
  describe('schedule-overlap constraints (P1-2): DB-authoritative', () => {
    // Distinct future windows per test so earlier sessions never collide.
    const win = (h: number) => [at(h * HOUR), at((h + 1) * HOUR)] as const;

    // Drizzle wraps pg errors (SQLSTATE on `.cause`), so surface the code directly.
    async function expectExclusionViolation(p: Promise<unknown>): Promise<void> {
      const err = (await p.then(() => null, (e: unknown) => e)) as { code?: string; cause?: { code?: string } } | null;
      expect(err?.code ?? err?.cause?.code).toBe('23P01');
    }

    function rawInsert(
      tenantId: string, profileId: string, sectionId: string | null, teacherId: string,
      start: string, end: string,
      status: 'draft' | 'scheduled' | 'waiting' | 'live' | 'failed' | 'expired' | 'cancelled' | 'ended' = 'scheduled',
      creatorId: string = ids.adminA,
    ) {
      return db.insert(liveClassSessions).values({
        tenantId, providerProfileId: profileId, classSectionId: sectionId, teacherUserId: teacherId,
        title: 'Raw', scheduledStart: start, scheduledEnd: end, status, creatorUserId: creatorId,
      }).returning();
    }

    it('concurrent identical raw inserts: exactly one wins, the other gets 23P01', async () => {
      const [s, e] = win(40);
      const results = await Promise.allSettled([
        rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e),
        rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e),
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = rejected[0]!.reason as { code?: string; cause?: { code?: string } };
      // PostgreSQL may surface the losing concurrent GiST insertion either as
      // the exclusion violation itself (23P01) or as a deadlock victim (40P01)
      // while the two index checks wait on each other. The invariant asserted
      // above is the contract: exactly one insert commits.
      expect(['23P01', '40P01']).toContain(reason.code ?? reason.cause?.code);
    });

    it('two concurrent createLiveSession for the same slot: one wins, one gets 409', async () => {
      const [s, e] = win(51);
      const input = baseInput({ teacherUserId: ids.tA1, scheduledStart: s, scheduledEnd: e });
      const results = await Promise.allSettled([
        createLiveSession(ctx(ids.adminA, tenantA), tenantA, input),
        createLiveSession(ctx(ids.adminA, tenantA), tenantA, input),
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = rejected[0]!.reason as { status?: number; code?: string };
      expect(reason.status).toBe(409);
      expect(reason.code).toBe('LIVE_SESSION_CONFLICT');
    });

    it('a teacher cannot be scheduled across two classes at the same time', async () => {
      const [s, e] = win(41);
      await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e);
      await expectExclusionViolation(rawInsert(tenantA, ref.profileA, ref.sectionA2, ids.tA1, s, e));
    });

    it('a class section cannot host two teachers at the same time', async () => {
      const [s, e] = win(42);
      await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e);
      await expectExclusionViolation(rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA2, s, e));
    });

    it('adjacent non-overlapping sessions are allowed ([start,end) semantics)', async () => {
      const [s, e] = win(43);
      const e2 = localIso(new Date(Date.parse(e) + HOUR));
      await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e);
      const second = await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, e, e2);
      // the DB returns timestamps with a space separator (naive local convention)
      expect(second[0]?.scheduledStart.replace('T', ' ')).toBe(e.replace('T', ' '));
    });

    it('cancelled and ended sessions free their slot; failed/draft still occupy it', async () => {
      // win(45) is free: the "adjacent" test deliberately occupies [43,44)+[44,45).
      const [s, e] = win(45);
      const first = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e))[0]!;
      await db.update(liveClassSessions).set({ status: 'ended' }).where(eq(liveClassSessions.id, first.id));
      const afterEnd = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e))[0]!;
      expect(afterEnd.status).toBe('scheduled');
      await db.update(liveClassSessions).set({ status: 'cancelled' }).where(eq(liveClassSessions.id, afterEnd.id));
      const afterCancel = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e))[0]!;
      expect(afterCancel.status).toBe('scheduled');
      // a `failed` session (recoverable via retry) must keep its slot
      await db.update(liveClassSessions).set({ status: 'failed' }).where(eq(liveClassSessions.id, afterCancel.id));
      await expectExclusionViolation(rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e));
    });

    it('an UPDATE that creates an overlap is rejected by the DB constraint', async () => {
      const [s, e] = win(46);
      await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e);
      const [s2, e2] = win(47);
      const b = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s2, e2))[0]!;
      await expectExclusionViolation(db.update(liveClassSessions).set({ scheduledStart: s, scheduledEnd: e })
        .where(eq(liveClassSessions.id, b.id)));
    });

    it('updating a session into an occupied window returns a friendly 409', async () => {
      const [s, e] = win(48);
      await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({ teacherUserId: ids.tA1, scheduledStart: s, scheduledEnd: e }));
      const [s2, e2] = win(49);
      const b = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({ teacherUserId: ids.tA1, scheduledStart: s2, scheduledEnd: e2 }));
      await expect(updateLiveSession(ctx(ids.adminA, tenantA), tenantA, b.id, { scheduledStart: s, scheduledEnd: e }))
        .rejects.toMatchObject({ status: 409, code: 'LIVE_SESSION_CONFLICT' });
    });

    it('adjacent sessions across a DST boundary do not collide; straddling does', async () => {
      const day = '2026-11-01T'; // US fall-back transition date, naive local times
      const a = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, `${day}00:00:00`, `${day}01:59:00`))[0]!;
      const b = (await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, `${day}02:00:00`, `${day}04:00:00`))[0]!;
      expect([a.status, b.status]).toEqual(['scheduled', 'scheduled']);
      await expectExclusionViolation(rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, `${day}01:00:00`, `${day}02:30:00`));
    });

    it('a conflict that slips past the pre-check still surfaces as 409 via the DB (TOCTOU)', async () => {
      // Deterministically reproduce the race: hold a conflicting row in an open
      // transaction so the service's pre-check read cannot see it, then commit
      // while the service INSERT is blocked on the exclusion index lock. The DB
      // aborts with 23P01 and the service must map it to 409 LIVE_SESSION_CONFLICT.
      const pool = db.$client as import('pg').Pool;
      const blocker = await pool.connect();
      try {
        const [s, e] = win(52);
        await blocker.query('BEGIN');
        await blocker.query(
          `insert into live_class_sessions
            (tenant_id, provider_profile_id, class_section_id, teacher_user_id, title,
             scheduled_start, scheduled_end, status, creator_user_id)
           values ($1,$2,$3,$4,'Blocker',$5,$6,'scheduled',$7)`,
          [tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e, ids.adminA],
        );
        const attempt = createLiveSession(ctx(ids.adminA, tenantA), tenantA,
          baseInput({ teacherUserId: ids.tA1, scheduledStart: s, scheduledEnd: e }));
        await blocker.query('COMMIT');
        await expect(attempt).rejects.toMatchObject({ status: 409, code: 'LIVE_SESSION_CONFLICT' });
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
      }
    });

    it('the same window is allowed across different tenants', async () => {
      const [s, e] = win(50);
      const a = await rawInsert(tenantA, ref.profileA, ref.sectionA1, ids.tA1, s, e, 'scheduled', ids.adminA);
      const b = await rawInsert(tenantB, ref.profileB, ref.sectionB, ids.tB1, s, e, 'scheduled', ids.adminB);
      expect([a[0]?.status, b[0]?.status]).toEqual(['scheduled', 'scheduled']);
    });
  });

  describe('start / end / cancel (concurrency-safe)', () => {
    it('start → live, end → ended, both idempotent; end-after-end is 409', async () => {
      const session = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.life[0]!, scheduledEnd: W.life[1]!,
      }));

      const live = await startLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id);
      expect(live.status).toBe('live');
      expect(live.actualStart).toBeTruthy();
      expect((await startLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id)).status).toBe('live');

      const ended = await endLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id);
      expect(ended.status).toBe('ended');
      expect(ended.actualEnd).toBeTruthy();
      expect((await endLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id)).status).toBe('ended');

      await expect(cancelLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id))
        .rejects.toMatchObject({ status: 409, code: 'SESSION_ALREADY_ENDED' });
    });

    it('a cancelled session cannot start', async () => {
      const session = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.cancel[0]!, scheduledEnd: W.cancel[1]!,
      }));
      const cancelled = await cancelLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id);
      expect(cancelled.status).toBe('cancelled');
      await expect(startLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id))
        .rejects.toMatchObject({ status: 409, code: 'SESSION_NOT_STARTABLE' });
    });

    it('concurrent starts converge to a single live transition', async () => {
      const session = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.start[0]!, scheduledEnd: W.start[1]!,
      }));

      const results = await Promise.allSettled([
        startLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id),
        startLiveSession(ctx(ids.adminA, tenantA), tenantA, session.id),
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ status: string; actualStart: string | null }>[];
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);
      expect(fulfilled.every(r => r.value.status === 'live')).toBe(true);
      expect(new Set(fulfilled.map(r => r.value.actualStart)).size).toBe(1);
    });
  });

  describe('join authorization', () => {
    it('lets a placed student (roster invitation) join as viewer', async () => {
      await db.insert(liveClassInvitations).values({
        tenantId: tenantA, sessionId: ref.openSessionId, userId: ids.sA,
        participantRole: 'student', joinEligible: true,
      });
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      expect(grant.role).toBe('viewer');
    });

    it('rejects a student who is not placed and not invited', async () => {
      await expect(issueJoinGrant(ctx(ids.sA2, tenantA, 'student'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'STUDENT_NOT_PLACED' });
    });

    it('hosts and admins join as moderator', async () => {
      const host = await issueJoinGrant(ctx(ids.tA1, tenantA, 'teacher'), tenantA, ref.openSessionId);
      expect(host.role).toBe('moderator');
      const admin = await issueJoinGrant(ctx(ids.adminA, tenantA), tenantA, ref.openSessionId);
      expect(admin.role).toBe('moderator');
    });

    it('blocks join before the window opens', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        scheduledStart: W.future1[0]!, scheduledEnd: W.future1[1]!,
      }));
      await expect(issueJoinGrant(ctx(ids.adminA, tenantA), tenantA, s.id))
        .rejects.toMatchObject({ status: 409, code: 'SESSION_JOIN_WINDOW_NOT_OPEN' });
    });

    it('blocks join after the window closes', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        scheduledStart: W.past[0]!, scheduledEnd: W.past[1]!,
      }));
      await expect(issueJoinGrant(ctx(ids.adminA, tenantA), tenantA, s.id))
        .rejects.toMatchObject({ status: 409, code: 'SESSION_JOIN_WINDOW_CLOSED' });
    });

    it('blocks join to a cancelled classroom', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        scheduledStart: W.future2[0]!, scheduledEnd: W.future2[1]!,
      }));
      await cancelLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id);
      await expect(issueJoinGrant(ctx(ids.adminA, tenantA), tenantA, s.id))
        .rejects.toMatchObject({ status: 409, code: 'SESSION_CANCELLED' });
    });

    it('redeems a grant into a dev join URL and rejects replay', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      const redeemed = await redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token);
      expect(redeemed.url).toMatch(/^\/dashboard\/academics\/live-class\//);
      expect(redeemed.url).not.toContain('join_token=');
      expect(redeemed.providerType).toBe('dev');

      await expect(redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token))
        .rejects.toMatchObject({ status: 401, code: 'JOIN_GRANT_REPLAYED' });
    });
  });

  // P1-3: a parent's access to a live-classroom session must go through the
  // SAME effective-guardian-relationship gate as the rest of the parent portal
  // (relationship-resolver.ts) — active status, effective-date window, academic
  // access right, and custody restriction — never a naive "any linked child".
  describe('guardian authorization (P1-3: effective relationship gate)', () => {
    const gsuffix = `${suffix}-g`;
    const pids = {
      withChild: `LC-PARENT-OK-${gsuffix}`,
      noGuardian: `LC-PARENT-NOENT-${gsuffix}`,
      inactive: `LC-PARENT-INACTIVE-${gsuffix}`,
      revoked: `LC-PARENT-REVOKED-${gsuffix}`,
      future: `LC-PARENT-FUTURE-${gsuffix}`,
      custody: `LC-PARENT-CUSTODY-${gsuffix}`,
      noAcademic: `LC-PARENT-NOACAD-${gsuffix}`,
      sibling: `LC-PARENT-SIBLING-${gsuffix}`,
    } as const;

    beforeAll(async () => {
      await db.insert(user).values(Object.values(pids).map(id => ({
        id, tenantId: tenantA, name: id, email: `${id.toLowerCase()}@test.local`, role: 'parent' as const, userStatus: 'active' as const,
      })));

      const [sy] = await db.insert(sessionYears).values({
        tenantId: tenantA, name: `SY-G-${gsuffix}`, startDate: '2026-09-01', endDate: '2027-06-30',
      }).returning();
      // Place both students (sA, sA2) in the open session's section so
      // placement is never the reason a case is denied unless noted.
      await db.insert(studentPlacements).values([
        { tenantId: tenantA, studentId: ids.sA, sessionYearId: sy!.id, classSectionId: ref.sectionA1, startDate: '2026-09-01', isCurrent: true },
      ]).onConflictDoNothing();

      async function link(parentId: string, over: Partial<typeof guardianStudents.$inferInsert> = {}) {
        const [g] = await db.insert(guardians).values({
          tenantId: tenantA, userId: parentId, firstName: 'P', lastName: parentId,
        }).returning();
        await db.insert(guardianStudents).values({
          tenantId: tenantA, guardianId: g!.id, studentId: ids.sA, relationshipType: 'parent',
          status: 'active', canAccessAcademic: true, ...over,
        });
        return g!.id;
      }

      await link(pids.withChild);
      await link(pids.inactive, { status: 'suspended' });
      await link(pids.revoked, { effectiveTo: localIso(new Date(now - HOUR)) });
      await link(pids.future, { effectiveFrom: localIso(new Date(now + 10 * HOUR)) });
      await link(pids.custody, { custodyRestriction: 'no-contact-order' });
      await link(pids.noAcademic, { canAccessAcademic: false });

      // Sibling case: guardian linked to sA (placed) and sA2 (NOT placed in
      // any section used by the open session) — sA2 stays denied for THIS
      // session while sA (once linked) would be allowed.
      const [gSib] = await db.insert(guardians).values({
        tenantId: tenantA, userId: pids.sibling, firstName: 'P', lastName: 'Sib',
      }).returning();
      await db.insert(guardianStudents).values([
        { tenantId: tenantA, guardianId: gSib!.id, studentId: ids.sA2, relationshipType: 'parent', status: 'active', canAccessAcademic: true },
      ]);
    });

    it('allows a parent with an effective, academic-access relationship to a placed child', async () => {
      const grant = await issueJoinGrant(ctx(pids.withChild, tenantA, 'parent'), tenantA, ref.openSessionId);
      expect(grant.role).toBe('viewer');
    });

    it('denies a parent-role user with no guardian entity at all', async () => {
      await expect(issueJoinGrant(ctx(pids.noGuardian, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies a guardian relationship that is not active (suspended)', async () => {
      await expect(issueJoinGrant(ctx(pids.inactive, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies a relationship whose effective window has ended (revoked)', async () => {
      await expect(issueJoinGrant(ctx(pids.revoked, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies a relationship whose effective window has not started yet', async () => {
      await expect(issueJoinGrant(ctx(pids.future, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies a custody-restricted guardian even with an otherwise-active relationship', async () => {
      await expect(issueJoinGrant(ctx(pids.custody, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies a guardian without academic access rights for the child', async () => {
      await expect(issueJoinGrant(ctx(pids.noAcademic, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('denies access via a sibling who is not placed in this session\'s class, even though the guardian has another effective child', async () => {
      await expect(issueJoinGrant(ctx(pids.sibling, tenantA, 'parent'), tenantA, ref.openSessionId))
        .rejects.toMatchObject({ status: 403, code: 'PARENT_NOT_LINKED' });
    });

    it('listMySessions for a parent only includes sessions for effectively-linked, placed children', async () => {
      const { listMySessions } = await import('./join-service');
      const rows = await listMySessions(ctx(pids.withChild, tenantA, 'parent'), tenantA);
      expect(rows.some(r => r.id === ref.openSessionId)).toBe(true);
      const blocked = await listMySessions(ctx(pids.custody, tenantA, 'parent'), tenantA);
      expect(blocked.some(r => r.id === ref.openSessionId)).toBe(false);
    });
  });

  describe('join grant durability (P0-1: atomic one-time redemption)', () => {
    // Make the block self-contained: the roster invitation for sA is also
    // created by the "join authorization" describe, but a test must not rely
    // on another test's side effects.
    beforeAll(async () => {
      await db.insert(liveClassInvitations).values({
        tenantId: tenantA, sessionId: ref.openSessionId, userId: ids.sA,
        participantRole: 'student', joinEligible: true,
      }).onConflictDoNothing();
    });

    function latestGrantRow(userId: string) {
      return db.select().from(liveClassJoinGrants)
        .where(and(
          eq(liveClassJoinGrants.sessionId, ref.openSessionId),
          eq(liveClassJoinGrants.userId, userId),
        ))
        .orderBy(desc(liveClassJoinGrants.createdAt))
        .limit(1);
    }

    it('persists only the nonce hash, bound to tenant/user/session/auth-session', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      const [row] = await latestGrantRow(ids.sA);
      expect(row?.tenantId).toBe(tenantA);
      expect(row?.sessionId).toBe(ref.openSessionId);
      expect(row?.userId).toBe(ids.sA);
      expect(row?.role).toBe('viewer');
      expect(row?.nonceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row?.nonceHash).not.toContain(grant.token);
      expect(row?.redeemedAt).toBeNull();
    });

    it('rejects replay after a process restart (DB is the single authority)', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      await redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token);
      // A "fresh process" has no in-memory cache; the DB row is consumed.
      await expect(redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token))
        .rejects.toMatchObject({ status: 401, code: 'JOIN_GRANT_REPLAYED' });
    });

    it('concurrent redemptions resolve to exactly one winner', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      const attempts = Array.from({ length: 10 }, () =>
        redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token));
      const results = await Promise.allSettled(attempts);
      const winners = results.filter(r => r.status === 'fulfilled');
      const losers = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(9);
      for (const loser of losers) {
        expect(loser.reason).toMatchObject({ status: 401, code: 'JOIN_GRANT_REPLAYED' });
      }
    });

    it('a grant minted in tenant A cannot be redeemed in tenant B', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      await expect(redeemJoinGrant(ctx(ids.adminB, tenantB), tenantB, ref.openSessionId, grant.token))
        .rejects.toMatchObject({ status: 403 });
    });

    it('a grant whose DB row expired is rejected (never double-redeemed)', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      const [row] = await latestGrantRow(ids.sA);
      await db.update(liveClassJoinGrants)
        .set({ expiresAt: localIso(new Date(Date.now() - 60_000)) })
        .where(eq(liveClassJoinGrants.nonceHash, row!.nonceHash));
      await expect(redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token))
        .rejects.toMatchObject({ status: 401 });
    });

    it('a grant row is consumed exactly once (redeemed_at set)', async () => {
      const grant = await issueJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId);
      await redeemJoinGrant(ctx(ids.sA, tenantA, 'student'), tenantA, ref.openSessionId, grant.token);
      const [row] = await latestGrantRow(ids.sA);
      expect(row?.redeemedAt).toBeTruthy();
    });
  });

  describe('webhook ingestion', () => {
    function signed(overrides: Record<string, unknown> = {}) {
      const body = {
        eventId: 'wb-1',
        meetingId: ref.openMeetingId,
        type: 'joined',
        externalParticipantId: `dev-user-${ids.sA}`,
        participantRole: 'viewer',
        timestamp: new Date().toISOString(),
        ...overrides,
      };
      const sig = createHmac('sha256', DEV_WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex');
      return { body, headers: { 'x-dev-signature': sig } };
    }

    it('records a forged delivery but never ingests an event', async () => {
      const body = { eventId: 'wb-forged', meetingId: ref.openMeetingId, type: 'error' };
      const res = await ingestWebhook('dev', {}, body);
      expect(res).toEqual({ signatureResult: 'unsigned', duplicate: false, eventIngested: false, sessionFound: true });

      const [receipt] = await db.select().from(liveClassWebhookReceipts)
        .where(eq(liveClassWebhookReceipts.providerEventId, 'wb-forged')).limit(1);
      expect(receipt?.signatureResult).toBe('unsigned');

      const [event] = await db.select().from(liveClassParticipantEvents)
        .where(eq(liveClassParticipantEvents.providerEventId, 'wb-forged')).limit(1);
      expect(event).toBeUndefined();
    });

    it('ingests a verified event exactly once (duplicate delivery is a no-op)', async () => {
      const first = signed();
      const res1 = await ingestWebhook('dev', first.headers, first.body);
      expect(res1).toEqual({ signatureResult: 'verified', duplicate: false, eventIngested: true, sessionFound: true });

      const res2 = await ingestWebhook('dev', first.headers, first.body);
      expect(res2).toEqual({ signatureResult: 'verified', duplicate: true, eventIngested: false, sessionFound: true });

      const rows = await db.select({ id: liveClassParticipantEvents.id }).from(liveClassParticipantEvents)
        .where(eq(liveClassParticipantEvents.providerEventId, 'wb-1'));
      expect(rows).toHaveLength(1);
    });

    it('concurrent identical deliveries: exactly one event is ingested, the rest report duplicate (P1-4 transactional receipt)', async () => {
      const delivery = signed({ eventId: `wb-concurrent-${Date.now()}` });
      const results = await Promise.all(
        Array.from({ length: 8 }, () => ingestWebhook('dev', delivery.headers, delivery.body)),
      );
      const ingested = results.filter(r => r.eventIngested);
      const duplicates = results.filter(r => r.duplicate);
      expect(ingested).toHaveLength(1);
      expect(duplicates).toHaveLength(7);

      const rows = await db.select({ id: liveClassParticipantEvents.id }).from(liveClassParticipantEvents)
        .where(eq(liveClassParticipantEvents.providerEventId, (delivery.body as { eventId: string }).eventId));
      expect(rows).toHaveLength(1);
    });

    // P1-4: webhook signature verification is bound to the SPECIFIC provider
    // profile the resolved session belongs to, never a single global
    // provider-wide secret. A profile with no webhookSecretRef configured
    // falls back to the labeled dev secret (existing `signed()` helper
    // above); a profile with an explicit ref must verify ONLY against that
    // secret.
    describe('per-profile webhook secret binding (P1-4)', () => {
      let profileCId = '';
      let sessionC = { id: '', meetingId: '' };
      const refName = `LIVE_WEBHOOK_SECRET_TEST_${suffix}`;
      const profileCSecret = `profile-c-secret-${suffix}-0123456789abcdef`;

      beforeAll(async () => {
        process.env[refName] = profileCSecret;
        const [profileC] = await db.insert(liveClassProviderProfiles).values({
          tenantId: tenantA, name: `Dev C ${suffix}`, providerType: 'dev', scope: 'tenant',
          capabilities: [], enabled: true, webhookSecretRef: refName,
        }).returning();
        profileCId = profileC!.id;

        const created = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
          providerProfileId: profileCId, scheduledStart: at(70 * HOUR), scheduledEnd: at(71 * HOUR),
        }));
        sessionC = { id: created.id, meetingId: created.providerMeetingId! };
      });

      function signedFor(meetingId: string, secret: string, overrides: Record<string, unknown> = {}) {
        const body = {
          eventId: `wb-profc-${crypto.randomUUID()}`,
          meetingId,
          type: 'joined',
          externalParticipantId: `dev-user-${ids.sA}`,
          participantRole: 'viewer',
          timestamp: new Date().toISOString(),
          ...overrides,
        };
        const sig = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
        return { body, headers: { 'x-dev-signature': sig } };
      }

      it('verifies with the profile\'s own configured secret', async () => {
        const delivery = signedFor(sessionC.meetingId, profileCSecret);
        const res = await ingestWebhook('dev', delivery.headers, delivery.body);
        expect(res).toMatchObject({ signatureResult: 'verified', eventIngested: true });
      });

      it('rejects a delivery signed with a DIFFERENT profile\'s secret (the global dev fallback), even though it targets THIS profile\'s meeting id', async () => {
        const delivery = signedFor(sessionC.meetingId, DEV_WEBHOOK_SECRET);
        const res = await ingestWebhook('dev', delivery.headers, delivery.body);
        expect(res).toMatchObject({ signatureResult: 'failed', eventIngested: false, sessionFound: true });
      });

      it('rejects a delivery for the DEFAULT profile (profileA) signed with profile C\'s secret', async () => {
        const delivery = signedFor(ref.openMeetingId, profileCSecret, { eventId: `wb-crossprofile-${crypto.randomUUID()}` });
        const res = await ingestWebhook('dev', delivery.headers, delivery.body);
        expect(res).toMatchObject({ signatureResult: 'failed', eventIngested: false, sessionFound: true });
      });
    });
  });

  describe('expiry sweep', () => {
    it('expires sessions whose end is in the past and keeps future ones', async () => {
      const past = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.expirePast[0]!, scheduledEnd: W.expirePast[1]!,
      }));
      const future = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, baseInput({
        teacherUserId: ids.tA2, classSectionId: ref.sectionA2, classSubjectId: ref.classSubjectA2,
        scheduledStart: W.expireFuture[0]!, scheduledEnd: W.expireFuture[1]!,
      }));

      const count = await expireStaleSessions(tenantA);
      expect(count).toBeGreaterThanOrEqual(1);

      expect((await loadSession(tenantA, past.id))?.status).toBe('expired');
      expect((await loadSession(tenantA, future.id))?.status).toBe('scheduled');
    });
  });

  describe('provider saga (P1-1): no network I/O inside a DB transaction', () => {
    let scriptedProfileId = '';

    beforeAll(async () => {
      setProviderOverrideForTest('scripted', scriptedProvider);
      const [p] = await db.insert(liveClassProviderProfiles).values({
        tenantId: tenantA, name: 'Scripted', providerType: 'scripted', scope: 'tenant',
        capabilities: [], enabled: true,
      }).returning();
      scriptedProfileId = p!.id;
    });

    afterAll(() => {
      setProviderOverrideForTest('scripted', null);
      clearScripts();
      resetProviderOpTimeoutForTest();
    });

    beforeEach(() => {
      resetProviderOpTimeoutForTest();
    });

    function sagaInput(overrides: Partial<CreateLiveSessionInput> = {}): CreateLiveSessionInput {
      return {
        providerProfileId: scriptedProfileId,
        classSectionId: ref.sectionA1,
        classSubjectId: ref.classSubjectA1,
        teacherUserId: ids.tA1,
        title: 'Saga de test',
        scheduledStart: W.override[0]!,
        scheduledEnd: W.override[1]!,
        policy,
        ...overrides,
      };
    }

    // Distinct future windows per test so same-teacher sessions never overlap.
    const win = (h: number) => [at(h * HOUR), at((h + 1) * HOUR)] as const;

    it('a hung provider times out into a recoverable failed session (never phantom live)', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...sagaInput({ scheduledStart: win(20)[0], scheduledEnd: win(20)[1] }), createAsDraft: true,
      });
      setCreateScript(s.id, { kind: 'hang' });
      setProviderOpTimeoutForTest(60);
      await expect(startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id))
        .rejects.toMatchObject({ status: 502, code: 'PROVIDER_CREATE_FAILED' });

      const failed = await loadSession(tenantA, s.id);
      expect(failed?.status).toBe('failed');
      expect(failed?.providerMeetingId).toBeNull();
      expect(failed?.failureReason).toContain('Délai dépassé');
      const [op] = await db.select().from(liveClassProviderOperations)
        .where(and(eq(liveClassProviderOperations.tenantId, tenantA), eq(liveClassProviderOperations.idempotencyKey, `create-room:${s.id}`)))
        .limit(1);
      expect(op?.status).toBe('failed');
    });

    it('retries the same session without creating a duplicate room', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...sagaInput({ scheduledStart: win(22)[0], scheduledEnd: win(22)[1] }), createAsDraft: true,
      });
      setCreateScript(s.id, { kind: 'hang' });
      setProviderOpTimeoutForTest(60);
      await expect(startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id)).rejects.toMatchObject({ status: 502 });

      setCreateScript(s.id, { kind: 'ok' });
      const live = await startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id);
      expect(live.status).toBe('live');
      expect(live.providerMeetingId).toBe(`scr-${s.id}`);
      expect(createRoomCalls(s.id)).toBe(2); // hung attempt + successful retry
      expect(roomIdCount(s.id)).toBe(1); // only ever one room id
    });

    it('concurrent workers converge on a single room with one provider call', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...sagaInput({ scheduledStart: win(24)[0], scheduledEnd: win(24)[1] }), createAsDraft: true,
      });
      setCreateScript(s.id, { kind: 'ok', delayMs: 200 });

      const results = await Promise.allSettled([
        startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id),
        startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id),
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ status: string; providerMeetingId: string | null }>[];
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);
      expect(fulfilled.every(r => r.value.status === 'live')).toBe(true);
      expect(new Set(fulfilled.map(r => r.value.providerMeetingId)).size).toBe(1);
      expect(createRoomCalls(s.id)).toBe(1); // the loser reused the winner's room
      expect(roomIdCount(s.id)).toBe(1);
    });

    it('recovers when the provider succeeded but the result was never persisted (stale running lease)', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...sagaInput({ scheduledStart: win(26)[0], scheduledEnd: win(26)[1] }), createAsDraft: true,
      });
      setCreateScript(s.id, { kind: 'ok' });
      // Simulate a worker that got a successful provider response but died before
      // persisting it: the op is stuck 'running' with an expired lease, and the
      // session mirrors the interrupted create as `failed`.
      await db.insert(liveClassProviderOperations).values({
        tenantId: tenantA, sessionId: s.id, providerProfileId: scriptedProfileId,
        operation: 'create_room', idempotencyKey: `create-room:${s.id}`,
        status: 'running', attempts: 1,
        updatedAt: localIso(new Date(Date.now() - 120_000)),
      }).onConflictDoNothing();
      await db.update(liveClassSessions).set({ status: 'failed', failureReason: 'interrupted' }).where(eq(liveClassSessions.id, s.id));

      const live = await startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id);
      expect(live.status).toBe('live');
      expect(live.providerMeetingId).toBe(`scr-${s.id}`);
      const [op] = await db.select().from(liveClassProviderOperations)
        .where(and(eq(liveClassProviderOperations.tenantId, tenantA), eq(liveClassProviderOperations.idempotencyKey, `create-room:${s.id}`)))
        .limit(1);
      expect(op?.status).toBe('succeeded');
      expect(op?.resultSnapshot).toEqual({ providerMeetingId: `scr-${s.id}` });
      expect(roomIdCount(s.id)).toBe(1); // never a duplicate room
    });

    it('succeeds when the provider responds after a delay, within the bounded window', async () => {
      setDefaultCreateScript({ kind: 'ok', delayMs: 150 });
      try {
        const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, sagaInput({
          scheduledStart: win(28)[0], scheduledEnd: win(28)[1],
        }));
        expect(s.status).toBe('scheduled');
        expect(s.providerMeetingId).toBe(`scr-${s.id}`);
        expect(createRoomCalls(s.id)).toBe(1);
      } finally {
        setDefaultCreateScript({ kind: 'ok' });
      }
    });

    it('cancellation during creation yields a valid cancelled state and cleans up the room', async () => {
      const s = await createLiveSession(ctx(ids.adminA, tenantA), tenantA, {
        ...sagaInput({ scheduledStart: win(30)[0], scheduledEnd: win(30)[1] }), createAsDraft: true,
      });
      setCreateScript(s.id, { kind: 'ok', delayMs: 800 });

      const startP = startLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id);
      await new Promise((r) => setTimeout(r, 200)); // let start claim the op and enter the provider call
      const cancelled = await cancelLiveSession(ctx(ids.adminA, tenantA), tenantA, s.id);
      expect(cancelled.status).toBe('cancelled');

      await expect(startP).rejects.toMatchObject({ status: 409, code: 'SESSION_NOT_STARTABLE' });

      const final = await loadSession(tenantA, s.id);
      expect(final?.status).toBe('cancelled'); // never resurrected to live/scheduled
      expect(final?.providerMeetingId).toBe(`scr-${s.id}`); // room id recorded, not lost
      expect(cancelRoomCalls(s.id)).toBe(1); // late-created room cleaned up once
      expect(roomIdCount(s.id)).toBe(1);
    });
  });
});
