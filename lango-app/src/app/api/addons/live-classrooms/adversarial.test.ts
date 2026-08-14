// P1-9: authenticated HTTP adversarial suite for the 23 live-classrooms route
// handlers (excludes webhooks/[providerType], which is provider-signed, not
// app-authenticated, by design).
//
// For every route + method:
//  - anonymous request -> 401 UNAUTHENTICATED
//  - authenticated but missing the required capability -> 403 FORBIDDEN
//  - (id-based routes) an authorized caller against a nonexistent id -> never
//    a 200 (false success) and never a 500 (crash) — typically 404/409/422
//  - (routes with a Zod `.strict()` body) an authorized caller with a
//    malformed body (an undeclared field) -> 422 VALIDATION_ERROR
// Plus dedicated checks for: addon-disabled -> 403 ADDON_NOT_ACTIVATED,
// cross-tenant id -> never a leak, and teacher-scope violations -> 403
// TEACHER_SCOPE (the gap fixed in session-service.ts alongside this suite).
//
// Mounts the actual Next.js route handlers (same pattern as
// src/app/api/tenant-isolation.test.ts / security.test.ts) against a real
// Postgres — skipped automatically unless DATABASE_URL is set.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const {
  addonEntitlements, classSections, classSubjects, classes, liveClassInvitations,
  liveClassProviderProfiles, liveClassSessions, mediums, sections,
  subjectTeachers, subjects, tenants, user,
} = await import('@/models/Schema');
const { createLiveSession } = await import('@/features/live-classrooms/services/session-service');

const healthRoute = await import('./health/route');
const mySessionsRoute = await import('./my-sessions/route');
const mySessionsJoinRoute = await import('./my-sessions/[id]/join/route');
const providerProfilesRoute = await import('./provider-profiles/route');
const providerProfileRoute = await import('./provider-profiles/[id]/route');
const providerProfileTestRoute = await import('./provider-profiles/[id]/test/route');
const reportsExportRoute = await import('./reports/export/route');
const reportsOverviewRoute = await import('./reports/overview/route');
const reportsSessionsRoute = await import('./reports/sessions/route');
const sessionsRoute = await import('./sessions/route');
const sessionRoute = await import('./sessions/[id]/route');
const sessionStartRoute = await import('./sessions/[id]/start/route');
const sessionEndRoute = await import('./sessions/[id]/end/route');
const sessionJoinRoute = await import('./sessions/[id]/join/route');
const sessionRedeemJoinRoute = await import('./sessions/[id]/redeem-join/route');
const sessionSyncRoute = await import('./sessions/[id]/sync/route');
const sessionAttendanceRoute = await import('./sessions/[id]/attendance/route');
const sessionReconcileRoute = await import('./sessions/[id]/reconcile/route');
const sessionPostAttendanceRoute = await import('./sessions/[id]/post-attendance/route');
const sessionMaterialsRoute = await import('./sessions/[id]/materials/route');
const sessionMaterialRoute = await import('./sessions/[id]/materials/[assetId]/route');
const sessionRecordingsRoute = await import('./sessions/[id]/recordings/route');
const sessionRecordingRoute = await import('./sessions/[id]/recordings/[recordingId]/route');

const hasDb = Boolean(process.env.DATABASE_URL);
const ABSENT_ID = '00000000-0000-0000-0000-000000000000';

// Every route's own RouteContext type pins a specific params shape
// ({id}, {id, assetId}, {id, recordingId}...) that doesn't structurally
// unify across routes — `any` here is a deliberate, narrow escape hatch for
// this harness only (adapting 23 differently-typed handlers to one generic
// table), not a general pattern.
type Handler = (req: Request, ctx?: any) => Promise<Response>;

type RouteCase = {
  name: string;
  method: string;
  handler: Handler;
  url: string;
  capability: string; // documentation only — actual gate is exercised via role
  idParam?: Record<string, string>; // params for the "valid, existing" resource
  unknownIdParam?: Record<string, string>; // params substituting an absent id
  body?: unknown; // a body that PASSES schema validation (used for the unknown-id check)
  hasStrictBody?: boolean; // whether a malformed-body (422) check applies
};

describe.skipIf(!hasDb)('live-classrooms adversarial HTTP suite (P1-9)', () => {
  const suffix = `adv-${Date.now()}`;
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID(); // addon NOT enabled here
  const ids = {
    adminA: `ADV-ADMIN-A-${suffix}`,
    hostTeacher: `ADV-HOST-${suffix}`,
    otherTeacher: `ADV-OTHER-${suffix}`,
    studentA: `ADV-STU-A-${suffix}`,
    accountantA: `ADV-ACCT-A-${suffix}`, // holds zero live.* capabilities
    adminB: `ADV-ADMIN-B-${suffix}`,
  } as const;

  let profileId = '';
  let sectionId = '';
  let classSubjectId = '';
  let sessionId = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: 'Adversarial A', slug: `adv-a-${suffix}` },
      { id: tenantB, name: 'Adversarial B', slug: `adv-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: ids.adminA, tenantId: tenantA, name: 'Admin A', email: `${ids.adminA}@test.local`.toLowerCase(), role: 'school_admin', userStatus: 'active' },
      { id: ids.hostTeacher, tenantId: tenantA, name: 'Host', email: `${ids.hostTeacher}@test.local`.toLowerCase(), role: 'teacher', userStatus: 'active' },
      { id: ids.otherTeacher, tenantId: tenantA, name: 'Other', email: `${ids.otherTeacher}@test.local`.toLowerCase(), role: 'teacher', userStatus: 'active' },
      { id: ids.studentA, tenantId: tenantA, name: 'Student', email: `${ids.studentA}@test.local`.toLowerCase(), role: 'student', userStatus: 'active' },
      { id: ids.accountantA, tenantId: tenantA, name: 'Accountant', email: `${ids.accountantA}@test.local`.toLowerCase(), role: 'accountant', userStatus: 'active' },
      { id: ids.adminB, tenantId: tenantB, name: 'Admin B', email: `${ids.adminB}@test.local`.toLowerCase(), role: 'school_admin', userStatus: 'active' },
    ]);
    await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'live-classrooms', isEnabled: true });
    // tenantB deliberately gets NO entitlement row -> hasAddon() is false.

    const [medium] = await db.insert(mediums).values({ tenantId: tenantA, name: `M ${suffix}` }).returning();
    const [klass] = await db.insert(classes).values({ tenantId: tenantA, name: `C ${suffix}`, mediumId: medium!.id }).returning();
    const [section] = await db.insert(sections).values({ tenantId: tenantA, name: `S ${suffix}` }).returning();
    const [subject] = await db.insert(subjects).values({ tenantId: tenantA, name: `Sub ${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId: tenantA, classId: klass!.id, sectionId: section!.id, mediumId: medium!.id }).returning();
    sectionId = cs!.id;
    const [csub] = await db.insert(classSubjects).values({ tenantId: tenantA, classId: klass!.id, subjectId: subject!.id, type: 'compulsory' }).returning();
    classSubjectId = csub!.id;
    await db.insert(subjectTeachers).values({ tenantId: tenantA, classSectionId: sectionId, subjectId: subject!.id, classSubjectId, teacherId: ids.hostTeacher });

    const [profile] = await db.insert(liveClassProviderProfiles).values({
      tenantId: tenantA, name: `Dev Adv ${suffix}`, providerType: 'dev', scope: 'tenant', capabilities: [], enabled: true,
    }).returning();
    profileId = profile!.id;

    const session = await createLiveSession(
      { userId: ids.adminA, tenantId: tenantA, branchId: null, role: 'school_admin', baseRole: 'school_admin', name: 'Admin A', email: 'a@test.local' },
      tenantA,
      {
        providerProfileId: profileId, classSectionId: sectionId, classSubjectId, teacherUserId: ids.hostTeacher,
        title: 'Adversarial fixture', scheduledStart: '2027-01-15T09:00:00', scheduledEnd: '2027-01-15T10:00:00',
        policy: { recordingEnabled: false, waitingRoom: false, chat: true, screenShare: true, guestPolicy: 'deny', maxParticipants: null },
      },
    );
    sessionId = session.id;
    await db.insert(liveClassInvitations).values({
      tenantId: tenantA, sessionId, userId: ids.studentA, participantRole: 'student', joinEligible: true,
    });
  }, 60_000);

  afterAll(async () => {
    await db.delete(liveClassSessions).where(eq(liveClassSessions.tenantId, tenantA));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  function req(url: string, method: string, body?: unknown): Request {
    return new Request(url, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
    });
  }

  // Typed `any`: this single helper feeds every route's differently-shaped
  // RouteContext (see the Handler type note above).
  function paramsOf(p: Record<string, string>): any {
    return { params: Promise.resolve(p) };
  }

  const emptyPolicyBody = { note: undefined };
  const validSessionCreateBody = () => ({
    providerProfileId: profileId, classSectionId: sectionId, classSubjectId, teacherUserId: ids.hostTeacher,
    title: 'x', scheduledStart: '2027-02-15T09:00:00', scheduledEnd: '2027-02-15T10:00:00',
    policy: { recordingEnabled: false, waitingRoom: false, chat: true, screenShare: true, guestPolicy: 'deny' },
  });

  const cases: RouteCase[] = [
    { name: 'health', method: 'GET', handler: healthRoute.GET, url: 'http://x/api/addons/live-classrooms/health', capability: 'live.read' },
    { name: 'my-sessions', method: 'GET', handler: mySessionsRoute.GET, url: 'http://x/api/addons/live-classrooms/my-sessions', capability: 'live.join' },
    {
      name: 'my-sessions/[id]/join', method: 'POST', handler: mySessionsJoinRoute.POST as Handler,
      url: 'http://x/api/addons/live-classrooms/my-sessions/x/join', capability: 'live.join',
      idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    { name: 'provider-profiles', method: 'GET', handler: providerProfilesRoute.GET, url: 'http://x/api/addons/live-classrooms/provider-profiles', capability: 'live.providers.manage' },
    {
      name: 'provider-profiles', method: 'POST', handler: providerProfilesRoute.POST, url: 'http://x/api/addons/live-classrooms/provider-profiles',
      capability: 'live.providers.manage', body: { name: `x-${crypto.randomUUID()}`, providerType: 'dev' }, hasStrictBody: true,
    },
    {
      name: 'provider-profiles/[id]', method: 'PATCH', handler: providerProfileRoute.PATCH as Handler,
      url: 'http://x/api/addons/live-classrooms/provider-profiles/x', capability: 'live.providers.manage',
      idParam: { id: profileId }, unknownIdParam: { id: ABSENT_ID }, body: {}, hasStrictBody: true,
    },
    {
      name: 'provider-profiles/[id]', method: 'DELETE', handler: providerProfileRoute.DELETE as Handler,
      url: 'http://x/api/addons/live-classrooms/provider-profiles/x', capability: 'live.providers.manage',
      idParam: { id: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID }, // never targets the real, in-use profile (it errors PROFILE_IN_USE, not the shape under test here)
    },
    {
      name: 'provider-profiles/[id]/test', method: 'POST', handler: providerProfileTestRoute.POST as Handler,
      url: 'http://x/api/addons/live-classrooms/provider-profiles/x/test', capability: 'live.providers.manage',
      idParam: { id: profileId }, unknownIdParam: { id: ABSENT_ID },
    },
    { name: 'reports/export', method: 'GET', handler: reportsExportRoute.GET, url: 'http://x/api/addons/live-classrooms/reports/export', capability: 'live.export' },
    { name: 'reports/overview', method: 'GET', handler: reportsOverviewRoute.GET, url: 'http://x/api/addons/live-classrooms/reports/overview', capability: 'live.reports.read' },
    { name: 'reports/sessions', method: 'GET', handler: reportsSessionsRoute.GET, url: 'http://x/api/addons/live-classrooms/reports/sessions', capability: 'live.reports.read' },
    { name: 'sessions', method: 'GET', handler: sessionsRoute.GET, url: 'http://x/api/addons/live-classrooms/sessions', capability: 'live.read' },
    {
      name: 'sessions', method: 'POST', handler: sessionsRoute.POST, url: 'http://x/api/addons/live-classrooms/sessions',
      capability: 'live.manage', body: validSessionCreateBody(), hasStrictBody: true,
    },
    {
      name: 'sessions/[id]', method: 'GET', handler: sessionRoute.GET as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x',
      capability: 'live.read', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]', method: 'PATCH', handler: sessionRoute.PATCH as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x',
      capability: 'live.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID }, body: {}, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]', method: 'DELETE', handler: sessionRoute.DELETE as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x',
      capability: 'live.manage', idParam: { id: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID }, // never targets the real session (would cancel the shared fixture)
      body: {}, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/start', method: 'POST', handler: sessionStartRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/start',
      capability: 'live.host', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/end', method: 'POST', handler: sessionEndRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/end',
      capability: 'live.host', idParam: { id: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID }, // never targets the real session (would end the shared fixture)
    },
    {
      name: 'sessions/[id]/join', method: 'POST', handler: sessionJoinRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/join',
      capability: 'live.join', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/redeem-join', method: 'POST', handler: sessionRedeemJoinRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/redeem-join',
      capability: 'live.join', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID }, body: { token: 'garbage-token' }, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/sync', method: 'POST', handler: sessionSyncRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/sync',
      capability: 'live.attendance.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/attendance', method: 'GET', handler: sessionAttendanceRoute.GET as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/attendance',
      capability: 'live.attendance.read', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/reconcile', method: 'POST', handler: sessionReconcileRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/reconcile',
      capability: 'live.attendance.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID }, body: emptyPolicyBody, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/post-attendance', method: 'POST', handler: sessionPostAttendanceRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/post-attendance',
      capability: 'live.attendance.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID }, body: emptyPolicyBody, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/materials', method: 'GET', handler: sessionMaterialsRoute.GET as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/materials',
      capability: 'live.read', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/materials', method: 'POST', handler: sessionMaterialsRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/materials',
      capability: 'live.recordings.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID }, body: { assetId: ABSENT_ID }, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/materials/[assetId]', method: 'DELETE', handler: sessionMaterialRoute.DELETE as Handler,
      url: 'http://x/api/addons/live-classrooms/sessions/x/materials/y', capability: 'live.recordings.manage',
      idParam: { id: sessionId, assetId: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID, assetId: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/recordings', method: 'GET', handler: sessionRecordingsRoute.GET as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/recordings',
      capability: 'live.recordings.read', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/recordings', method: 'POST', handler: sessionRecordingsRoute.POST as Handler, url: 'http://x/api/addons/live-classrooms/sessions/x/recordings',
      capability: 'live.recordings.manage', idParam: { id: sessionId }, unknownIdParam: { id: ABSENT_ID },
    },
    {
      name: 'sessions/[id]/recordings/[recordingId]', method: 'PATCH', handler: sessionRecordingRoute.PATCH as Handler,
      url: 'http://x/api/addons/live-classrooms/sessions/x/recordings/y', capability: 'live.recordings.manage',
      idParam: { id: sessionId, recordingId: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID, recordingId: ABSENT_ID },
      body: { retentionDays: 30 }, hasStrictBody: true,
    },
    {
      name: 'sessions/[id]/recordings/[recordingId]', method: 'DELETE', handler: sessionRecordingRoute.DELETE as Handler,
      url: 'http://x/api/addons/live-classrooms/sessions/x/recordings/y', capability: 'live.recordings.manage',
      idParam: { id: sessionId, recordingId: ABSENT_ID }, unknownIdParam: { id: ABSENT_ID, recordingId: ABSENT_ID },
    },
  ];

  // Sanity: this harness must actually exercise every route file under
  // src/app/api/addons/live-classrooms (excluding the provider-signed
  // webhook receiver) — a missing case is a silent gap, not a pass.
  it('covers all 23 authenticated live-classrooms route handlers', () => {
    const distinctFiles = new Set(cases.map(c => c.name));
    expect(distinctFiles.size).toBe(23); // all 23 route.ts files under this addon except the provider-signed webhook receiver
    expect(cases.length).toBeGreaterThanOrEqual(31); // one case per (route, method) pair
  });

  for (const c of cases) {
    describe(`${c.method} ${c.name}`, () => {
      it('rejects an anonymous request with 401', async () => {
        currentSessionUserId = null;
        const res = await c.handler(req(c.url, c.method, c.body), c.idParam ? paramsOf(c.idParam) : undefined);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe('UNAUTHENTICATED');
      });

      it('rejects an authenticated caller with no live.* capability with 403', async () => {
        currentSessionUserId = ids.accountantA;
        const res = await c.handler(req(c.url, c.method, c.body), c.idParam ? paramsOf(c.idParam) : undefined);
        expect(res.status).toBe(403);
        currentSessionUserId = null;
      });

      it('rejects a request when the live-classrooms addon is not activated for the tenant', async () => {
        currentSessionUserId = ids.adminB;
        const res = await c.handler(req(c.url, c.method, c.body), c.idParam ? paramsOf({ ...c.idParam }) : undefined);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe('ADDON_NOT_ACTIVATED');
        currentSessionUserId = null;
      });

      if (c.unknownIdParam) {
        it('never returns 200 or 500 for an authorized caller against a nonexistent id', async () => {
          currentSessionUserId = ids.adminA;
          const res = await c.handler(req(c.url, c.method, c.body), paramsOf(c.unknownIdParam!));
          expect(res.status).not.toBe(200);
          expect(res.status).toBeLessThan(500);
          currentSessionUserId = null;
        });
      }

      if (c.hasStrictBody) {
        it('rejects a malformed body (undeclared field) with 422 for an authorized caller', async () => {
          currentSessionUserId = ids.adminA;
          const res = await c.handler(
            req(c.url, c.method, { __adversarial_garbage_field__: true }),
            c.idParam ? paramsOf(c.idParam) : undefined,
          );
          expect(res.status).toBe(422);
          const json = await res.json();
          expect(json.error.code).toBe('VALIDATION_ERROR');
          currentSessionUserId = null;
        });
      }
    });
  }

  // ---------------------------------------------------------------------
  // Teacher-scope violations: a non-host teacher (who DOES hold live.host /
  // live.manage tenant-wide) must never be able to start/end/cancel/update
  // ANOTHER teacher's session (session-service.ts assertTeacherOwnsSession,
  // added alongside this suite).
  // ---------------------------------------------------------------------
  describe('teacher-scope violations (non-host teacher vs. a hosted session)', () => {
    it('start: denied for a non-host teacher', async () => {
      currentSessionUserId = ids.otherTeacher;
      const res = await sessionStartRoute.POST(req('http://x/.../start', 'POST'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('TEACHER_SCOPE');
      currentSessionUserId = null;
    });

    it('end: denied for a non-host teacher', async () => {
      currentSessionUserId = ids.otherTeacher;
      const res = await sessionEndRoute.POST(req('http://x/.../end', 'POST'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('TEACHER_SCOPE');
      currentSessionUserId = null;
    });

    it('update (PATCH): denied for a non-host teacher', async () => {
      currentSessionUserId = ids.otherTeacher;
      const res = await sessionRoute.PATCH(req('http://x/.../id', 'PATCH', {}), paramsOf({ id: sessionId }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('TEACHER_SCOPE');
      currentSessionUserId = null;
    });

    it('cancel (DELETE): denied for a non-host teacher', async () => {
      currentSessionUserId = ids.otherTeacher;
      const res = await sessionRoute.DELETE(req('http://x/.../id', 'DELETE', {}), paramsOf({ id: sessionId }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('TEACHER_SCOPE');
      currentSessionUserId = null;
    });

    it('detail (GET): denied for a non-host teacher (existing behavior, regression-guarded here)', async () => {
      currentSessionUserId = ids.otherTeacher;
      const res = await sessionRoute.GET(req('http://x/.../id', 'GET'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(403);
      currentSessionUserId = null;
    });

    it('the HOST teacher is still allowed to start their own session', async () => {
      currentSessionUserId = ids.hostTeacher;
      const res = await sessionStartRoute.POST(req('http://x/.../start', 'POST'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(200);
      currentSessionUserId = null;
    });
  });

  // ---------------------------------------------------------------------
  // Cross-tenant: an admin from tenant B (different tenant, addon enabled
  // separately) must never read/act on tenant A's session by id.
  // ---------------------------------------------------------------------
  describe('cross-tenant isolation (dedicated, feature-scoped regression)', () => {
    let profileB = '';
    beforeAll(async () => {
      await db.insert(addonEntitlements).values({ tenantId: tenantB, addonId: 'live-classrooms', isEnabled: true });
      const [p] = await db.insert(liveClassProviderProfiles).values({
        tenantId: tenantB, name: `Dev B ${suffix}`, providerType: 'dev', scope: 'tenant', capabilities: [], enabled: true,
      }).returning();
      profileB = p!.id;
    });
    afterAll(async () => {
      await db.delete(liveClassProviderProfiles).where(and(eq(liveClassProviderProfiles.tenantId, tenantB), eq(liveClassProviderProfiles.id, profileB)));
      await db.delete(addonEntitlements).where(and(eq(addonEntitlements.tenantId, tenantB), eq(addonEntitlements.addonId, 'live-classrooms')));
    });

    it('GET session detail from another tenant never leaks (404, never 200)', async () => {
      currentSessionUserId = ids.adminB;
      const res = await sessionRoute.GET(req('http://x/.../id', 'GET'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(404);
      currentSessionUserId = null;
    });

    it('start another tenant\'s session never succeeds (404, never 200)', async () => {
      currentSessionUserId = ids.adminB;
      const res = await sessionStartRoute.POST(req('http://x/.../start', 'POST'), paramsOf({ id: sessionId }));
      expect(res.status).toBe(404);
      currentSessionUserId = null;
    });
  });
});
