// DB-backed tests for the attendance evidence chain (P1-5 / P1-6):
//  - interval union, reconnect counting, late/early grace, presence threshold
//  - deterministic re-derivation for the same immutable event set
//  - reconciliation-state preservation across re-derivation
//  - the authoritative core-register posting path + its idempotency guard
//
// Skipped automatically unless DATABASE_URL is set (migrations must be
// applied) — same convention as live-classrooms-db.test.ts.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  attendance, attendanceRegisters, classSections, classSubjects, classes,
  liveClassAttendanceSummaries, liveClassParticipantEvents, liveClassProviderProfiles,
  liveClassSessions, mediums, sections, subjectTeachers, subjects, tenants, user,
} from '@/models/Schema';
import type { LiveClassPolicy } from '@/features/live-classrooms/models/live-classrooms-schema';
import { createLiveSession, type CreateLiveSessionInput } from './session-service';
import { getSummaries, postAttendance, reconcileAttendance } from './attendance-service';

const hasDb = Boolean(process.env.DATABASE_URL);

function ctx(userId: string, tenantId: string, role: RequestContext['role'] = 'school_admin'): RequestContext {
  return { userId, tenantId, branchId: null, role, baseRole: role, name: 'Test User', email: `${userId}@test.local` };
}

const policy: LiveClassPolicy = {
  recordingEnabled: false, waitingRoom: false, chat: true, screenShare: true,
  guestPolicy: 'deny', maxParticipants: null,
};

describe.skipIf(!hasDb)('attendance-service (P1-5 calculations, P1-6 posting)', () => {
  const suffix = `att-${Date.now()}`;
  const tenantId = crypto.randomUUID();
  const ids = {
    admin: `AT-ADMIN-${suffix}`,
    teacher: `AT-TEACHER-${suffix}`,
    sPresent: `AT-S-PRESENT-${suffix}`,
    sLate: `AT-S-LATE-${suffix}`,
    sEarly: `AT-S-EARLY-${suffix}`,
    sUnknown: `AT-S-UNKNOWN-${suffix}`,
    sAbsentEvidence: `AT-S-ABSENTEV-${suffix}`,
    sReconnect: `AT-S-RECONNECT-${suffix}`,
  } as const;

  let profileId = '';
  let sectionId = '';
  let classSubjectId = '';
  let classId = '';

  // The DB stores timestamp(mode:'string') columns as naive LOCAL time (no
  // offset). `providerTimestamp` must be written the same way — a `.toISOString()`
  // ('Z'-suffixed UTC) value gets silently offset-converted by Postgres on
  // insert, corrupting the very offsets these tests assert on. Mirrors
  // `toLocalNaive` in session-service.ts.
  function naiveLocal(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // Every test gets its OWN calendar day (same hour) so neither the P1-2
  // schedule-overlap constraint (same teacher/section, same time) NOR the
  // attendance-register lock (keyed by classId+date+period — postAttendance
  // always uses period 0) collide across tests. Attendance derivation only
  // cares about offsets relative to scheduledStart, never wall-clock "now".
  const GRACE = 300; // LATE_GRACE_SECONDS / EARLY_GRACE_SECONDS in attendance-service.ts
  let nextDay = 1;

  async function createSession(): Promise<{ id: string; startMs: number; date: string }> {
    const day = String(nextDay++).padStart(2, '0');
    const date = `2026-02-${day}`;
    const start = `${date}T09:00:00`;
    const end = `${date}T10:00:00`;
    const input: CreateLiveSessionInput = {
      providerProfileId: profileId,
      classSectionId: sectionId,
      classSubjectId,
      teacherUserId: ids.teacher,
      title: `Attendance test ${crypto.randomUUID()}`,
      scheduledStart: start,
      scheduledEnd: end,
      policy,
    };
    const session = await createLiveSession(ctx(ids.admin, tenantId), tenantId, input);
    return { id: session.id, startMs: new Date(start).getTime(), date };
  }

  let eventSeq = 0;
  async function seedEvents(
    session: { id: string; startMs: number },
    userId: string,
    events: Array<{ type: 'joined' | 'left' | 'reconnect'; at: number }>,
  ) {
    for (const e of events) {
      eventSeq += 1;
      await db.insert(liveClassParticipantEvents).values({
        tenantId,
        sessionId: session.id,
        providerEventId: `att-evt-${suffix}-${eventSeq}`,
        providerProfileId: profileId,
        userId,
        externalParticipantId: `dev-user-${userId}`,
        participantRole: 'viewer',
        eventType: e.type,
        providerTimestamp: naiveLocal(session.startMs + e.at * 1000),
        rawPayload: { test: true },
        processingStatus: 'processed',
      });
    }
  }

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Attendance Tenant', slug: `attendance-${suffix}` });
    await db.insert(user).values([
      { id: ids.admin, tenantId, name: 'Admin', email: `${ids.admin}@test.local`.toLowerCase(), role: 'school_admin', userStatus: 'active' },
      { id: ids.teacher, tenantId, name: 'Teacher', email: `${ids.teacher}@test.local`.toLowerCase(), role: 'teacher', userStatus: 'active' },
      { id: ids.sPresent, tenantId, name: 'S Present', email: `${ids.sPresent}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.sLate, tenantId, name: 'S Late', email: `${ids.sLate}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.sEarly, tenantId, name: 'S Early', email: `${ids.sEarly}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.sUnknown, tenantId, name: 'S Unknown', email: `${ids.sUnknown}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.sAbsentEvidence, tenantId, name: 'S AbsentEv', email: `${ids.sAbsentEvidence}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.sReconnect, tenantId, name: 'S Reconnect', email: `${ids.sReconnect}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `Medium ${suffix}` }).returning();
    const [klass] = await db.insert(classes).values({ tenantId, name: `Classe ${suffix}`, mediumId: medium!.id }).returning();
    classId = klass!.id;
    const [section] = await db.insert(sections).values({ tenantId, name: `Sec ${suffix}` }).returning();
    const [subject] = await db.insert(subjects).values({ tenantId, name: `Matiere ${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId, sectionId: section!.id, mediumId: medium!.id }).returning();
    sectionId = cs!.id;
    const [csub] = await db.insert(classSubjects).values({ tenantId, classId, subjectId: subject!.id, type: 'compulsory' }).returning();
    classSubjectId = csub!.id;
    await db.insert(subjectTeachers).values({ tenantId, classSectionId: sectionId, subjectId: subject!.id, classSubjectId, teacherId: ids.teacher });

    const [profile] = await db.insert(liveClassProviderProfiles).values({
      tenantId, name: 'Dev Attendance', providerType: 'dev', scope: 'tenant', capabilities: [], enabled: true,
    }).returning();
    profileId = profile!.id;
  }, 60_000);

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(liveClassSessions).where(eq(liveClassSessions.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  describe('calculations (P1-5): interval union, reconnect, grace, threshold', () => {
    it('full-duration attendance (join at start, leave at end) is present with no lateness', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.status).toBe('present');
      expect(row?.totalPresenceSeconds).toBe(3600);
      expect(row?.reconnectCount).toBe(0);
    });

    it('a join after the late grace window (>5min) is classified late', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sLate, [{ type: 'joined', at: GRACE + 100 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.status).toBe('late');
      // lateJoinSeconds is the raw offset from scheduledStart, not the
      // overage past the grace window.
      expect(row?.lateJoinSeconds).toBe(GRACE + 100);
    });

    it('a leave before the early grace window (>5min early) is classified early', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sEarly, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 - GRACE - 100 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.status).toBe('early');
      // earlyLeaveSeconds is the raw offset from scheduledEnd, not the
      // overage past the grace window.
      expect(row?.earlyLeaveSeconds).toBe(GRACE + 100);
    });

    it('low total presence with disjoint intervals (interval union) yields unknown, not present', async () => {
      const session = await createSession();
      // Present near the start and near the end only — first join and last
      // leave both fall inside grace, but the union of presence time is well
      // under the 60% threshold.
      await seedEvents(session, ids.sUnknown, [
        { type: 'joined', at: 0 }, { type: 'left', at: 200 },
        { type: 'joined', at: 3400 }, { type: 'left', at: 3600 },
      ]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.status).toBe('unknown');
      expect(row?.totalPresenceSeconds).toBe(400);
    });

    it('a "left" event with no preceding "joined" contributes no presence (absent)', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sAbsentEvidence, [{ type: 'left', at: 500 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.status).toBe('absent');
      expect(row?.totalPresenceSeconds).toBe(0);
    });

    it('a join while already open (reconnect) closes and reopens the interval without losing presence time', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sReconnect, [
        { type: 'joined', at: 0 }, { type: 'joined', at: 1000 }, { type: 'left', at: 3600 },
      ]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.reconnectCount).toBe(1);
      expect(row?.totalPresenceSeconds).toBe(3600); // union is contiguous — no gap, no double count
      expect(row?.status).toBe('present');
    });

    it('re-deriving the same immutable event set is deterministic', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const first = await getSummaries(tenantId, session.id);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const second = await getSummaries(tenantId, session.id);
      expect(second[0]?.status).toBe(first[0]?.status);
      expect(second[0]?.totalPresenceSeconds).toBe(first[0]?.totalPresenceSeconds);
      expect(second[0]?.intervals).toEqual(first[0]?.intervals);
    });

    it('a manual override requires a reason', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await expect(reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {
        manual: [{ userId: ids.sPresent, status: 'absent' }],
      })).rejects.toMatchObject({ status: 422, code: 'REASON_REQUIRED' });

      const result = await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {
        manual: [{ userId: ids.sPresent, status: 'absent' }], note: 'Vérification manuelle',
      });
      expect(result.find(r => r.userId === ids.sPresent)?.status).toBe('absent');
    });

    it('a reconciliation state of approved/posted is preserved across re-derivation', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      await db.update(liveClassAttendanceSummaries)
        .set({ reconciliationState: 'approved' })
        .where(and(eq(liveClassAttendanceSummaries.sessionId, session.id), eq(liveClassAttendanceSummaries.userId, ids.sPresent)));

      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      const [row] = await getSummaries(tenantId, session.id);
      expect(row?.reconciliationState).toBe('approved');
    });
  });

  describe('posting (P1-6): authoritative register path + idempotency', () => {
    it('posts reconciled student summaries into the core attendance register, skips unknown, ignores non-students', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await seedEvents(session, ids.sAbsentEvidence, [{ type: 'left', at: 100 }]); // absent
      await seedEvents(session, ids.teacher, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]); // host — non-student
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});

      const result = await postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      expect(result.posted).toBe(2); // sPresent + sAbsentEvidence (teacher is not a student)

      const rows = await db.select().from(attendance).where(and(
        eq(attendance.tenantId, tenantId), eq(attendance.date, session.date),
      ));
      const byStudent = new Map(rows.map(r => [r.studentId, r]));
      expect(byStudent.get(ids.sPresent)?.status).toBe('present');
      expect(byStudent.get(ids.sAbsentEvidence)?.status).toBe('absent');
      expect(byStudent.has(ids.teacher)).toBe(false);

      const [summary] = await db.select().from(liveClassAttendanceSummaries)
        .where(and(eq(liveClassAttendanceSummaries.sessionId, session.id), eq(liveClassAttendanceSummaries.userId, ids.sPresent)));
      expect(summary?.reconciliationState).toBe('posted');
    });

    it('is idempotent: re-posting an already-posted session is rejected, not duplicated', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});
      await postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});

      await expect(postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {}))
        .rejects.toMatchObject({ status: 409, code: 'NOTHING_TO_POST' });

      const rows = await db.select().from(attendance).where(and(
        eq(attendance.tenantId, tenantId), eq(attendance.studentId, ids.sPresent), eq(attendance.date, session.date),
      ));
      expect(rows).toHaveLength(1); // no duplicate row from the rejected re-post
    });

    it('refuses to post a session that was never reconciled', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await expect(postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {}))
        .rejects.toMatchObject({ status: 409, code: 'NOTHING_TO_POST' });
    });

    it('concurrent posting of the same reconciled session converges without duplicate rows', async () => {
      const session = await createSession();
      await seedEvents(session, ids.sPresent, [{ type: 'joined', at: 0 }, { type: 'left', at: 3600 }]);
      await reconcileAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {});

      const results = await Promise.allSettled([
        postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {}),
        postAttendance(ctx(ids.admin, tenantId), tenantId, session.id, {}),
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);

      const rows = await db.select().from(attendance).where(and(
        eq(attendance.tenantId, tenantId), eq(attendance.studentId, ids.sPresent), eq(attendance.date, session.date),
      ));
      expect(rows).toHaveLength(1);
    });
  });
});
