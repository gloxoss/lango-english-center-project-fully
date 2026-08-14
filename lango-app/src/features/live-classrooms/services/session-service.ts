// Live Classrooms session lifecycle: scheduling saga, provider-room creation
// (idempotent), start/end/cancel with concurrency-safe transitions.
//
// Design rules (see future-implementation/live-classrooms/.implementation-plan):
//  - Tenant, teacher, roster and every foreign id are verified tenant-scoped.
//  - Provider room creation is a saga guarded by a unique idempotency key:
//    retries never double-create a room; failure never leaves a phantom `live`.
//  - start/end/cancel lock the session row (SELECT ... FOR UPDATE) so races
//    resolve to exactly one valid outcome.
import { and, desc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  academicClassOfferings, classSections, classSubjects, classScheduleSlots, classes,
  liveClassInvitations, liveClassParticipantEvents, liveClassProviderOperations,
  liveClassProviderProfiles, liveClassSessions, sections, subjectTeachers, subjects, user,
} from '@/models/Schema';
import {
  getProviderOrThrow, isProviderFailure, type ProviderConfig, type ProviderOperationResult,
} from '@/features/live-classrooms/providers';
import { recordAudit } from '@/libs/api/audit';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import type { LiveClassPolicy } from '@/features/live-classrooms/models/live-classrooms-schema';

export function toEpochMs(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// The DB stores timestamp(mode:'string') as naive LOCAL time (create form sends
// datetime-local values). Format the same way so SQL string-range comparisons
// against the stored values are tz-correct (toISOString() would shift them by
// the server's UTC offset).
export function toLocalNaive(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type LiveClassSessionRow = typeof liveClassSessions.$inferSelect;
export type LiveClassProfileRow = typeof liveClassProviderProfiles.$inferSelect;

export type CreateLiveSessionInput = {
  providerProfileId: string;
  classOfferingId?: string | null;
  classSectionId: string;
  classSubjectId: string;
  teacherUserId: string;
  title: string;
  description?: string | null;
  objectives?: string | null;
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
  timezone?: string;
  policy: LiveClassPolicy;
  sourceTimetableSlotId?: string | null;
  /** Admin-only override of the subject-teacher assignment check. Requires a reason. */
  adminOverrideReason?: string | null;
  createAsDraft?: boolean;
};

export type UpdateLiveSessionInput = Partial<CreateLiveSessionInput>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function assertPolicyShape(policy: LiveClassPolicy): void {
  if (typeof policy.recordingEnabled !== 'boolean') throw new ApiError(422, 'INVALID_POLICY', 'Politique d\'enregistrement invalide.');
  if (policy.maxParticipants != null && (!Number.isInteger(policy.maxParticipants) || policy.maxParticipants < 0)) {
    throw new ApiError(422, 'INVALID_POLICY', 'Nombre maximum de participants invalide.');
  }
}

async function assertAcademicTargetsAreValid(
  tenantId: string,
  input: { classSectionId: string; classSubjectId: string; teacherUserId: string },
  opts: { actorRole: RequestContext['role']; actorUserId: string; adminOverrideReason?: string | null },
): Promise<{ classId: string }> {
  const [section] = await db.select({ classId: classSections.classId }).from(classSections)
    .where(and(eq(classSections.id, input.classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
  if (!section) throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe n\'existe pas pour cet établissement.');

  const [classSubject] = await db.select({ classId: classSubjects.classId }).from(classSubjects)
    .where(and(eq(classSubjects.id, input.classSubjectId), eq(classSubjects.tenantId, tenantId))).limit(1);
  if (!classSubject) throw new ApiError(422, 'INVALID_REFERENCE', 'La matière n\'existe pas pour cet établissement.');
  if (classSubject.classId !== section.classId) {
    throw new ApiError(422, 'SUBJECT_NOT_IN_CLASS', 'Cette matière n\'est pas assignée à la classe de cette section.');
  }

  const [teacher] = await db.select({ role: user.role, tenantId: user.tenantId }).from(user)
    .where(and(eq(user.id, input.teacherUserId), eq(user.tenantId, tenantId))).limit(1);
  if (!teacher) throw new ApiError(422, 'INVALID_REFERENCE', 'Cet enseignant n\'existe pas pour cet établissement.');
  if (teacher.role !== 'teacher') throw new ApiError(422, 'TEACHER_NOT_ALLOWED', 'L\'enseignant indiqué ne porte pas le rôle enseignant.');

  // Assignment check: the teacher must teach this subject in this section.
  const [assignment] = await db.select({ id: subjectTeachers.id }).from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.classSectionId, input.classSectionId),
      eq(subjectTeachers.classSubjectId, input.classSubjectId),
      eq(subjectTeachers.teacherId, input.teacherUserId),
    )).limit(1);

  if (!assignment) {
    const isAdmin = opts.actorRole === 'school_admin' || opts.actorRole === 'super_admin';
    if (!isAdmin || !opts.adminOverrideReason?.trim()) {
      throw new ApiError(422, 'TEACHER_NOT_ASSIGNED', 'Cet enseignant n\'est pas assigné à cette matière pour cette section.');
    }
  }

  // A teacher (non-admin) may only create/host sessions for class sections they
  // are assigned to (class teacher or subject teacher).
  if (opts.actorRole === 'teacher' && input.teacherUserId === opts.actorUserId) {
    const scoped = await getTeacherClassSectionIds(tenantId, opts.actorUserId);
    if (!scoped.includes(input.classSectionId)) {
      throw new ApiError(403, 'TEACHER_SCOPE', 'Vous ne pouvez créer une classe virtuelle que pour vos propres classes.');
    }
  }

  return { classId: section.classId };
}

// P1-11: composite-tenant FK hardening. classOfferingId / sourceTimetableSlotId
// are optional, single-column FKs (the referenced tables live outside this
// feature) — Postgres can only verify the id EXISTS, not that it belongs to
// this tenant. Without this preflight check a request in tenant A could
// silently attach a tenant-B offering/slot id (it exists, just not here) and
// the FK constraint alone would never catch it. Reject before the row is ever
// written, with the same clear INVALID_REFERENCE 422 used elsewhere.
async function assertTenantScopedOptionalRefs(
  tenantId: string,
  input: { classOfferingId?: string | null; sourceTimetableSlotId?: string | null },
): Promise<void> {
  if (input.classOfferingId) {
    const [row] = await db.select({ id: academicClassOfferings.id }).from(academicClassOfferings)
      .where(and(eq(academicClassOfferings.id, input.classOfferingId), eq(academicClassOfferings.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new ApiError(422, 'INVALID_REFERENCE', 'L\'offre de classe indiquée n\'existe pas pour cet établissement.');
  }
  if (input.sourceTimetableSlotId) {
    const [row] = await db.select({ id: classScheduleSlots.id }).from(classScheduleSlots)
      .where(and(eq(classScheduleSlots.id, input.sourceTimetableSlotId), eq(classScheduleSlots.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new ApiError(422, 'INVALID_REFERENCE', 'Le créneau d\'emploi du temps source n\'existe pas pour cet établissement.');
  }
}

// A teacher may only start/end/cancel/update sessions they host — the same
// scope enforced on create (assertAcademicTargetsAreValid) and on the detail
// read (getSessionDetail). `live.host` / `live.manage` are granted to every
// teacher tenant-wide, so without this check any teacher could operate on
// any OTHER teacher's live class (P1-9 adversarial-suite finding).
// Admin/super_admin are exempt by design (they manage every session).
function assertTeacherOwnsSession(ctx: RequestContext, session: LiveClassSessionRow): void {
  if (ctx.role === 'teacher' && session.teacherUserId !== ctx.userId) {
    throw new ApiError(403, 'TEACHER_SCOPE', 'Vous ne pouvez agir que sur vos propres classes virtuelles.');
  }
}

async function assertNoLiveSessionOverlap(
  tenantId: string,
  input: { classSectionId: string; teacherUserId: string; scheduledStart: string; scheduledEnd: string },
  excludeSessionId?: string,
): Promise<void> {
  const filters = [eq(liveClassSessions.tenantId, tenantId)];
  if (excludeSessionId) filters.push(ne(liveClassSessions.id, excludeSessionId));

  const candidates = await db
    .select({
      id: liveClassSessions.id,
      title: liveClassSessions.title,
      classSectionId: liveClassSessions.classSectionId,
      teacherUserId: liveClassSessions.teacherUserId,
      scheduledStart: liveClassSessions.scheduledStart,
      scheduledEnd: liveClassSessions.scheduledEnd,
      status: liveClassSessions.status,
    })
    .from(liveClassSessions)
    .where(and(...filters));

  // Postgres returns timestamp(mode:'string') as "YYYY-MM-DD HH:mm:ss" while
  // form input uses "YYYY-MM-DDTHH:mm:ss" — raw string comparison would
  // misjudge overlaps, so compare on epoch milliseconds instead.
  const inputStart = toEpochMs(input.scheduledStart);
  const inputEnd = toEpochMs(input.scheduledEnd);

  for (const c of candidates) {
    if (c.status === 'cancelled' || c.status === 'ended') continue;
    const cStart = toEpochMs(c.scheduledStart);
    const cEnd = toEpochMs(c.scheduledEnd);
    if (!(inputStart < cEnd && cStart < inputEnd)) continue;
    if (c.teacherUserId === input.teacherUserId) {
      throw new ApiError(409, 'LIVE_SESSION_CONFLICT', `L'enseignant est déjà pris sur "${c.title}" (${c.scheduledStart} - ${c.scheduledEnd}).`);
    }
    if (c.classSectionId === input.classSectionId) {
      throw new ApiError(409, 'LIVE_SESSION_CONFLICT', `La classe a déjà une session en direct "${c.title}" sur ce créneau.`);
    }
  }
}

// The pre-check above is a friendly fast-path; the EXCLUDE constraints added by
// migration 0091 are the authoritative guard. A concurrent conflicting INSERT or
// UPDATE that slips past the read aborts with SQLSTATE 23P01 — surface it as the
// same 409 LIVE_SESSION_CONFLICT instead of a raw driver error.
function assertNotOverlapViolation(err: unknown): void {
  // Drizzle wraps the pg error in DrizzleQueryError and exposes the original on
  // `.cause` — the SQLSTATE lives there, not on the wrapper.
  const cause = (err as { cause?: { code?: string } })?.cause;
  const code = (err as { code?: string })?.code ?? cause?.code;
  if (code === '23P01') {
    throw new ApiError(409, 'LIVE_SESSION_CONFLICT', 'Conflit d\'horaire : un enseignant ou une classe est déjà réservé sur ce créneau.');
  }
}

async function loadProfile(tenantId: string, providerProfileId: string): Promise<LiveClassProfileRow> {
  const [profile] = await db.select().from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, providerProfileId), eq(liveClassProviderProfiles.tenantId, tenantId), eq(liveClassProviderProfiles.enabled, true)))
    .limit(1);
  if (!profile) throw new ApiError(422, 'INVALID_REFERENCE', 'Le profil fournisseur n\'existe pas ou est désactivé pour cet établissement.');
  return profile;
}

function providerConfig(profile: LiveClassProfileRow): ProviderConfig {
  return { baseUrl: profile.baseUrl, accountId: profile.accountId };
}

// ---------------------------------------------------------------------------
// Provider-operation saga (P1-1)
//
// NEVER holds a PostgreSQL transaction open during external network I/O. The
// lifecycle (create/start/end/cancel) reserves state atomically first, then
// calls the provider with a bounded timeout, then persists the outcome in its
// own short transaction. The operation row (unique tenantId + idempotencyKey)
// makes retries idempotent, concurrent workers converge on a single result, and
// a worker crash recoverable (stale `running` leases are reclaimed).
// ---------------------------------------------------------------------------

let providerOpTimeoutMs = 10_000;
const OP_SETTLE_POLL_MS = 20;
// A worker that lost the claim waits for the winner's outcome. The winner may
// legitimately be in-flight for up to `providerOpTimeoutMs`, so the loser's
// settle window must exceed that (plus a persist/schedule margin) or concurrent
// workers would spuriously report PROVIDER_OP_IN_PROGRESS under slow providers.
const OP_SETTLE_MARGIN_MS = 3_000;
const OP_RECLAIM_GRACE_MS = 5_000;

/** Test seam: shrink the provider-call bound so a hung provider times out fast. */
export function setProviderOpTimeoutForTest(ms: number): void { providerOpTimeoutMs = ms; }
export function resetProviderOpTimeoutForTest(): void { providerOpTimeoutMs = 10_000; }

type ProviderOpRow = typeof liveClassProviderOperations.$inferSelect;

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ApiError(502, 'PROVIDER_TIMEOUT', `Délai dépassé pour ${what} (${ms} ms).`)),
      ms,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

type ClaimOperationParams = {
  tenantId: string;
  sessionId: string;
  providerProfileId: string;
  operation: 'create_room' | 'cancel_room';
  opKey: string;
};

// Atomically claim the operation row: exactly one worker wins the
// pending→running transition; a `failed` row or a stale `running` lease
// (owner crashed) is reclaimed by the next worker; otherwise the row is owned
// by someone else and the caller waits for its outcome.
async function claimProviderOperation(params: ClaimOperationParams): Promise<{ op: ProviderOpRow; owned: boolean }> {
  const now = toLocalNaive(new Date());
  await db.insert(liveClassProviderOperations).values({
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    providerProfileId: params.providerProfileId,
    operation: params.operation,
    idempotencyKey: params.opKey,
    status: 'pending',
    attempts: 1,
    updatedAt: now,
  }).onConflictDoNothing({ target: [liveClassProviderOperations.tenantId, liveClassProviderOperations.idempotencyKey] });

  const claimFrom = (fromStatus: 'pending' | 'failed' | 'running') =>
    db.update(liveClassProviderOperations)
      .set({ status: 'running', attempts: sql`${liveClassProviderOperations.attempts} + 1`, updatedAt: toLocalNaive(new Date()) })
      .where(and(
        eq(liveClassProviderOperations.tenantId, params.tenantId),
        eq(liveClassProviderOperations.idempotencyKey, params.opKey),
        eq(liveClassProviderOperations.status, fromStatus),
      ))
      .returning();

  const [fresh] = await claimFrom('pending');
  if (fresh) return { op: fresh, owned: true };

  // Reclaim a failed previous run (retry) or a stale running lease (crash).
  const staleThreshold = toLocalNaive(new Date(Date.now() - (providerOpTimeoutMs + OP_RECLAIM_GRACE_MS)));
  const [reclaimed] = await db.update(liveClassProviderOperations)
    .set({ status: 'running', attempts: sql`${liveClassProviderOperations.attempts} + 1`, updatedAt: toLocalNaive(new Date()) })
    .where(and(
      eq(liveClassProviderOperations.tenantId, params.tenantId),
      eq(liveClassProviderOperations.idempotencyKey, params.opKey),
      or(
        eq(liveClassProviderOperations.status, 'failed'),
        and(
          eq(liveClassProviderOperations.status, 'running'),
          sql`${liveClassProviderOperations.updatedAt} < ${staleThreshold}`,
        ),
      ),
    ))
    .returning();
  if (reclaimed) return { op: reclaimed, owned: true };

  const [existing] = await db.select().from(liveClassProviderOperations)
    .where(and(
      eq(liveClassProviderOperations.tenantId, params.tenantId),
      eq(liveClassProviderOperations.idempotencyKey, params.opKey),
    )).limit(1);
  if (!existing) throw new ApiError(502, 'PROVIDER_OP_CLAIM_FAILED', 'Aucune opération fournisseur réservée.');
  return { op: existing, owned: false };
}

async function waitForOpSettled(tenantId: string, opKey: string): Promise<ProviderOpRow> {
  const deadline = Date.now() + providerOpTimeoutMs + OP_SETTLE_MARGIN_MS;
  for (;;) {
    const [row] = await db.select().from(liveClassProviderOperations)
      .where(and(
        eq(liveClassProviderOperations.tenantId, tenantId),
        eq(liveClassProviderOperations.idempotencyKey, opKey),
      )).limit(1);
    if (!row) throw new ApiError(502, 'PROVIDER_OP_CLAIM_FAILED', 'Aucune opération fournisseur réservée.');
    if (row.status === 'succeeded' || row.status === 'failed') return row;
    if (Date.now() >= deadline) {
      throw new ApiError(502, 'PROVIDER_OP_IN_PROGRESS', 'Une autre requête traite encore cette opération fournisseur.');
    }
    await new Promise((r) => setTimeout(r, OP_SETTLE_POLL_MS));
  }
}

async function recordOpFailure(tenantId: string, opKey: string, error: string): Promise<void> {
  await db.update(liveClassProviderOperations)
    .set({ status: 'failed', error, updatedAt: toLocalNaive(new Date()) })
    .where(and(
      eq(liveClassProviderOperations.tenantId, tenantId),
      eq(liveClassProviderOperations.idempotencyKey, opKey),
    ));
}

// Persist the create-room outcome atomically (no external I/O). Returns what
// happened to the session so the caller can clean up a room created after the
// session was closed:
//   - 'promoted': session moved (or stayed) schedulable with the room attached;
//   - 'live':     the session was started concurrently — keep the room;
//   - 'terminal': the session was cancelled/ended/expired mid-flight — record
//     the room id for the audit trail but never resurrect the session.
async function persistCreateRoomOutcome(
  tenantId: string,
  opKey: string,
  session: LiveClassSessionRow,
  mid: string,
): Promise<'promoted' | 'live' | 'terminal'> {
  const now = toLocalNaive(new Date());
  return db.transaction(async (tx) => {
    await tx.update(liveClassProviderOperations)
      .set({ status: 'succeeded', resultSnapshot: { providerMeetingId: mid }, error: null, updatedAt: now })
      .where(and(
        eq(liveClassProviderOperations.tenantId, tenantId),
        eq(liveClassProviderOperations.idempotencyKey, opKey),
      ));

    const [promoted] = await tx.update(liveClassSessions)
      .set({ providerMeetingId: mid, status: 'scheduled', failureReason: null, updatedAt: now })
      .where(and(
        eq(liveClassSessions.id, session.id),
        sql`${liveClassSessions.status} IN ('draft', 'scheduled', 'waiting', 'failed')`,
      ))
      .returning({ status: liveClassSessions.status });
    if (promoted) return 'promoted' as const;

    const [current] = await tx.select({ status: liveClassSessions.status }).from(liveClassSessions)
      .where(eq(liveClassSessions.id, session.id)).limit(1);
    if (current?.status === 'live') return 'live' as const;

    if (session.providerMeetingId !== mid) {
      await tx.update(liveClassSessions)
        .set({ providerMeetingId: mid, updatedAt: now })
        .where(and(eq(liveClassSessions.id, session.id), sql`${liveClassSessions.providerMeetingId} IS NULL`));
    }
    return 'terminal' as const;
  });
}

async function cancelRoomAtProvider(
  tenantId: string,
  sessionId: string,
  profile: LiveClassProfileRow,
  providerMeetingId: string,
  reason: string,
): Promise<void> {
  const opKey = `cancel-room:${sessionId}`;
  const claim = await claimProviderOperation({
    tenantId, sessionId, providerProfileId: profile.id, operation: 'cancel_room', opKey,
  });
  if (!claim.owned) {
    await waitForOpSettled(tenantId, opKey); // another worker is cancelling — reuse its outcome
    return;
  }
  const provider = getProviderOrThrow(profile.providerType);
  try {
    const res = await withTimeout(
      provider.cancelRoom({ providerMeetingId, reason, config: providerConfig(profile) }),
      providerOpTimeoutMs,
      'annulation de salle',
    );
    if (isProviderFailure(res)) {
      await recordOpFailure(tenantId, opKey, res.error ?? 'Annulation refusée par le fournisseur.');
      return;
    }
    await db.update(liveClassProviderOperations)
      .set({ status: 'succeeded', resultSnapshot: { providerMeetingId }, updatedAt: toLocalNaive(new Date()) })
      .where(and(eq(liveClassProviderOperations.tenantId, tenantId), eq(liveClassProviderOperations.idempotencyKey, opKey)));
  } catch {
    // Best-effort: the session state is already committed; a provider outage
    // during cleanup is recorded but never blocks the caller.
    await recordOpFailure(tenantId, opKey, 'Annulation fournisseur en échec.');
  }
}

// Ensure a provider room exists for the session, calling the provider OUTSIDE
// any transaction. Idempotent: a succeeded op is reused, a failed op is retried
// under the same key (no duplicate room), and concurrent workers converge on the
// single result recorded by the winner.
async function executeCreateRoom(
  tenantId: string,
  session: LiveClassSessionRow,
  profile: LiveClassProfileRow,
): Promise<string> {
  if (session.providerMeetingId) return session.providerMeetingId;

  const opKey = `create-room:${session.id}`;
  const claim = await claimProviderOperation({
    tenantId, sessionId: session.id, providerProfileId: profile.id, operation: 'create_room', opKey,
  });

  if (!claim.owned) {
    const settled = await waitForOpSettled(tenantId, opKey);
    if (settled.status === 'succeeded' && settled.resultSnapshot) {
      const mid = (settled.resultSnapshot as { providerMeetingId?: string }).providerMeetingId;
      if (mid) return mid;
    }
    throw new ApiError(502, 'PROVIDER_CREATE_FAILED', settled.error ?? 'La création de la salle fournisseur a échoué.');
  }

  if (claim.op.status === 'succeeded' && claim.op.resultSnapshot) {
    const mid = (claim.op.resultSnapshot as { providerMeetingId?: string }).providerMeetingId;
    if (mid) return mid;
  }

  const provider = getProviderOrThrow(profile.providerType);
  let result: { providerMeetingId: string } | ProviderOperationResult;
  try {
    result = await withTimeout(
      provider.createRoom({
        sessionId: session.id,
        title: session.title,
        scheduledStart: session.scheduledStart,
        scheduledEnd: session.scheduledEnd,
        policy: session.policy as LiveClassPolicy,
        config: providerConfig(profile),
      }),
      providerOpTimeoutMs,
      'création de salle',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur fournisseur.';
    await recordOpFailure(tenantId, opKey, message);
    throw new ApiError(502, 'PROVIDER_CREATE_FAILED', message);
  }

  if (isProviderFailure(result)) {
    const message = result.error ?? 'La création de la salle fournisseur a échoué.';
    await recordOpFailure(tenantId, opKey, message);
    throw new ApiError(502, 'PROVIDER_CREATE_FAILED', message);
  }

  const mid = result.providerMeetingId;
  const outcome = await persistCreateRoomOutcome(tenantId, opKey, session, mid);
  if (outcome === 'terminal') {
    await cancelRoomAtProvider(tenantId, session.id, profile, mid, 'room-created-after-session-closed');
  }
  return mid;
}

// ---------------------------------------------------------------------------
// Create / update / cancel
// ---------------------------------------------------------------------------

export async function createLiveSession(
  ctx: RequestContext,
  tenantId: string,
  input: CreateLiveSessionInput,
): Promise<LiveClassSessionRow> {
  if (!(input.scheduledStart < input.scheduledEnd)) {
    throw new ApiError(422, 'INVALID_TIME_RANGE', 'L\'heure de fin doit être après l\'heure de début.');
  }
  assertPolicyShape(input.policy);
  const profile = await loadProfile(tenantId, input.providerProfileId);
  const { classId } = await assertAcademicTargetsAreValid(tenantId, input, {
    actorRole: ctx.role, actorUserId: ctx.userId, adminOverrideReason: input.adminOverrideReason,
  });
  await assertTenantScopedOptionalRefs(tenantId, input);
  await assertNoLiveSessionOverlap(tenantId, input);

  let session: LiveClassSessionRow;
  try {
    const [created] = await db
      .insert(liveClassSessions)
      .values({
        tenantId,
        providerProfileId: profile.id,
        classOfferingId: input.classOfferingId ?? null,
        classSectionId: input.classSectionId,
        classSubjectId: input.classSubjectId,
        teacherUserId: input.teacherUserId,
        title: input.title.trim(),
        description: input.description ?? null,
        objectives: input.objectives ?? null,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        timezone: input.timezone ?? 'Africa/Casablanca',
        status: input.createAsDraft ? 'draft' : 'scheduled',
        policy: input.policy,
        sourceTimetableSlotId: input.sourceTimetableSlotId ?? null,
        creatorUserId: ctx.userId,
      })
      .returning();
    session = created!;
  } catch (err) {
    assertNotOverlapViolation(err);
    throw err;
  }

  if (input.createAsDraft) {
    recordAudit(ctx, 'create', 'live_class_session', session.id, { title: session.title, status: 'draft' });
    return session;
  }

  // The provider-room saga runs OUTSIDE any transaction: the session is already
  // reserved (committed), the op row carries the idempotency key, and the
  // provider call is bounded. A failure leaves a recoverable `failed` session
  // (retried via start) — never a phantom `live` or a lost room id.
  try {
    const providerMeetingId = await executeCreateRoom(tenantId, session, profile);
    recordAudit(ctx, 'create', 'live_class_session', session.id, {
      title: session.title, classSectionId: session.classSectionId, teacherUserId: session.teacherUserId,
      providerMeetingId,
    });
    return (await loadSession(tenantId, session.id))!;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur fournisseur.';
    await db.update(liveClassSessions)
      .set({ status: 'failed', failureReason: message, updatedAt: toLocalNaive(new Date()) })
      .where(and(eq(liveClassSessions.id, session.id), sql`${liveClassSessions.status} IN ('scheduled', 'waiting')`));
    recordAudit(ctx, 'create', 'live_class_session', session.id, { status: 'failed', reason: 'provider' });
    throw err;
  }
}

export async function updateLiveSession(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  input: UpdateLiveSessionInput,
): Promise<LiveClassSessionRow> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertTeacherOwnsSession(ctx, session);
  if (session.status === 'live' || session.status === 'ended' || session.status === 'cancelled') {
    throw new ApiError(409, 'SESSION_NOT_EDITABLE', 'Une session en cours, terminée ou annulée n\'est pas modifiable.');
  }

  const merged: CreateLiveSessionInput = {
    providerProfileId: input.providerProfileId ?? session.providerProfileId,
    classSectionId: input.classSectionId ?? session.classSectionId!,
    classSubjectId: input.classSubjectId ?? session.classSubjectId!,
    teacherUserId: input.teacherUserId ?? session.teacherUserId,
    title: input.title ?? session.title,
    scheduledStart: input.scheduledStart ?? session.scheduledStart,
    scheduledEnd: input.scheduledEnd ?? session.scheduledEnd,
    policy: (input.policy ?? session.policy) as LiveClassPolicy,
    classOfferingId: input.classOfferingId ?? session.classOfferingId,
    sourceTimetableSlotId: input.sourceTimetableSlotId ?? session.sourceTimetableSlotId,
    description: input.description ?? session.description,
    objectives: input.objectives ?? session.objectives,
    timezone: input.timezone ?? session.timezone,
    adminOverrideReason: input.adminOverrideReason,
  };

  if (!(merged.scheduledStart < merged.scheduledEnd)) {
    throw new ApiError(422, 'INVALID_TIME_RANGE', 'L\'heure de fin doit être après l\'heure de début.');
  }
  assertPolicyShape(merged.policy);
  const profile = await loadProfile(tenantId, merged.providerProfileId);
  await assertAcademicTargetsAreValid(tenantId, merged, { actorRole: ctx.role, actorUserId: ctx.userId, adminOverrideReason: merged.adminOverrideReason });
  await assertTenantScopedOptionalRefs(tenantId, merged);
  await assertNoLiveSessionOverlap(tenantId, merged, sessionId);

  let updated: LiveClassSessionRow;
  try {
    const [row] = await db
      .update(liveClassSessions)
      .set({
        providerProfileId: profile.id,
        classOfferingId: merged.classOfferingId ?? null,
        classSectionId: merged.classSectionId,
        classSubjectId: merged.classSubjectId,
        teacherUserId: merged.teacherUserId,
        title: merged.title.trim(),
        description: merged.description,
        objectives: merged.objectives,
        scheduledStart: merged.scheduledStart,
        scheduledEnd: merged.scheduledEnd,
        timezone: merged.timezone,
        policy: merged.policy,
        sourceTimetableSlotId: merged.sourceTimetableSlotId ?? null,
        failureReason: null,
        updatedAt: toLocalNaive(new Date()),
      })
      .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId)))
      .returning();
    updated = row!;
  } catch (err) {
    assertNotOverlapViolation(err);
    throw err;
  }
  recordAudit(ctx, 'update', 'live_class_session', sessionId, { title: merged.title });
  return updated;
}

export async function cancelLiveSession(ctx: RequestContext, tenantId: string, sessionId: string, reason?: string): Promise<LiveClassSessionRow> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertTeacherOwnsSession(ctx, session);
  if (session.status === 'ended') throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'Session déjà terminée.');
  if (session.status === 'cancelled') return session;

  // Commit the authoritative state first (no external I/O), then clean up the
  // provider room best-effort outside the transaction.
  const [updated] = await db.update(liveClassSessions)
    .set({ status: 'cancelled', failureReason: reason ?? null, updatedAt: toLocalNaive(new Date()) })
    .where(and(eq(liveClassSessions.id, sessionId), sql`${liveClassSessions.status} NOT IN ('ended', 'cancelled')`))
    .returning();

  if (updated) {
    if (updated.providerMeetingId) {
      const profile = await loadProfile(tenantId, updated.providerProfileId);
      await cancelRoomAtProvider(tenantId, sessionId, profile, updated.providerMeetingId, reason ?? 'cancel');
    }
    recordAudit(ctx, 'update', 'live_class_session', sessionId, { action: 'cancel', reason });
    return updated;
  }

  const [current] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (current?.status === 'cancelled') return current;
  throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'Session déjà terminée.');
}

// ---------------------------------------------------------------------------
// Start / end (concurrency-safe)
// ---------------------------------------------------------------------------

export async function startLiveSession(ctx: RequestContext, tenantId: string, sessionId: string): Promise<LiveClassSessionRow> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertTeacherOwnsSession(ctx, session);
  if (session.status === 'live') return session; // idempotent: already live
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw new ApiError(409, 'SESSION_NOT_STARTABLE', 'Une session terminée ou annulée ne peut pas démarrer.');
  }

  // Ensure the room first (saga, outside any transaction) — a retry after a
  // failed create reuses the same idempotency key, so it never duplicates the
  // room. Only then transition to `live` atomically.
  const profile = await loadProfile(tenantId, session.providerProfileId);
  let providerMeetingId: string;
  try {
    providerMeetingId = await executeCreateRoom(tenantId, session, profile);
  } catch (err) {
    // Provider outage => a recoverable failed state, never a phantom live.
    await db.update(liveClassSessions)
      .set({ status: 'failed', failureReason: err instanceof Error ? err.message : 'Erreur fournisseur.', updatedAt: toLocalNaive(new Date()) })
      .where(and(
        eq(liveClassSessions.id, sessionId),
        sql`${liveClassSessions.status} IN ('scheduled', 'waiting', 'draft', 'failed')`,
      ));
    recordAudit(ctx, 'update', 'live_class_session', sessionId, { action: 'start', status: 'failed' });
    throw err;
  }

  const now = toLocalNaive(new Date());
  const [started] = await db.update(liveClassSessions)
    .set({ providerMeetingId, status: 'live', actualStart: session.actualStart ?? now, failureReason: null, updatedAt: now })
    .where(and(
      eq(liveClassSessions.id, sessionId),
      eq(liveClassSessions.tenantId, tenantId),
      sql`${liveClassSessions.status} NOT IN ('ended', 'cancelled')`,
      ne(liveClassSessions.status, 'live'),
    ))
    .returning();

  if (started) {
    recordAudit(ctx, 'update', 'live_class_session', sessionId, { action: 'start' });
    return started;
  }

  // Lost the race to a concurrent start/cancel/end — return the authoritative state.
  const [current] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (current?.status === 'live') return current;
  throw new ApiError(409, 'SESSION_NOT_STARTABLE', 'Une session terminée ou annulée ne peut pas démarrer.');
}

export async function endLiveSession(ctx: RequestContext, tenantId: string, sessionId: string): Promise<LiveClassSessionRow> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertTeacherOwnsSession(ctx, session);
  if (session.status === 'ended') return session; // idempotent
  if (session.status === 'draft' || session.status === 'cancelled') {
    throw new ApiError(409, 'SESSION_NOT_ENDABLE', 'Seule une session démarrée ou en attente peut être terminée.');
  }

  // Commit the authoritative state first (no external I/O), then clean up the
  // provider room best-effort outside the transaction.
  const now = toLocalNaive(new Date());
  const profile = await loadProfile(tenantId, session.providerProfileId);
  const [updated] = await db.update(liveClassSessions)
    .set({ status: 'ended', actualEnd: session.actualEnd ?? now, updatedAt: now })
    .where(and(
      eq(liveClassSessions.id, sessionId),
      sql`${liveClassSessions.status} NOT IN ('draft', 'cancelled', 'ended')`,
    ))
    .returning();

  if (updated) {
    if (updated.providerMeetingId) {
      await cancelRoomAtProvider(tenantId, sessionId, profile, updated.providerMeetingId, 'end');
    }
    recordAudit(ctx, 'update', 'live_class_session', sessionId, { action: 'end' });
    return updated;
  }

  const [current] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (current?.status === 'ended') return current; // concurrent end won
  if (current?.status === 'draft' || current?.status === 'cancelled') {
    throw new ApiError(409, 'SESSION_NOT_ENDABLE', 'Seule une session démarrée ou en attente peut être terminée.');
  }
  return current!; // concurrent transition (e.g. cancel) — return authoritative state
}

// ---------------------------------------------------------------------------
// Expiration sweep & conflict preview
// ---------------------------------------------------------------------------

export async function expireStaleSessions(tenantId: string): Promise<number> {
  const now = toLocalNaive(new Date());
  const stale = await db
    .select({ id: liveClassSessions.id })
    .from(liveClassSessions)
    .where(and(
      eq(liveClassSessions.tenantId, tenantId),
      sql`${liveClassSessions.status} IN ('scheduled', 'waiting')`,
      sql`${liveClassSessions.scheduledEnd} < ${now}`,
    ));
  if (stale.length === 0) return 0;
  const ids = stale.map(s => s.id);
  await db.update(liveClassSessions)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(liveClassSessions.tenantId, tenantId), sql`${liveClassSessions.id} IN (${sql.join(ids, sql`, `)})`));
  return ids.length;
}

export async function loadSession(tenantId: string, sessionId: string): Promise<LiveClassSessionRow | null> {
  const [row] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// List / detail (enriched, tenant-scoped, capped)
// ---------------------------------------------------------------------------

const SESSION_STATUSES = ['draft', 'scheduled', 'waiting', 'live', 'ended', 'cancelled', 'failed', 'expired'] as const;

export type SessionListFilters = {
  status?: string;
  teacherUserId?: string;
  classSectionId?: string;
  classSubjectId?: string;
  providerProfileId?: string;
  from?: string; // ISO scheduled-start lower bound
  to?: string; // ISO scheduled-start upper bound
  page?: number;
  pageSize?: number;
};

export type SessionListRow = {
  id: string;
  title: string;
  status: string;
  providerType: string | null;
  profileName: string | null;
  teacherName: string | null;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  providerMeetingId: string | null;
  creatorUserId: string | null;
  createdAt: string;
};

export async function listLiveSessions(tenantId: string, filters: SessionListFilters): Promise<{
  rows: SessionListRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  const where: SQL[] = [eq(liveClassSessions.tenantId, tenantId)];
  if (filters.status && (SESSION_STATUSES as readonly string[]).includes(filters.status)) {
    where.push(eq(liveClassSessions.status, filters.status as never));
  }
  if (filters.teacherUserId) where.push(eq(liveClassSessions.teacherUserId, filters.teacherUserId));
  if (filters.classSectionId) where.push(eq(liveClassSessions.classSectionId, filters.classSectionId));
  if (filters.classSubjectId) where.push(eq(liveClassSessions.classSubjectId, filters.classSubjectId));
  if (filters.providerProfileId) where.push(eq(liveClassSessions.providerProfileId, filters.providerProfileId));
  if (filters.from) where.push(sql`${liveClassSessions.scheduledStart} >= ${filters.from}`);
  if (filters.to) where.push(sql`${liveClassSessions.scheduledStart} <= ${filters.to}`);

  const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(liveClassSessions).where(and(...where));
  const total = countRow?.value ?? 0;
  const rows = await db
    .select({
      id: liveClassSessions.id,
      title: liveClassSessions.title,
      status: liveClassSessions.status,
      providerType: liveClassProviderProfiles.providerType,
      profileName: liveClassProviderProfiles.name,
      teacherName: user.name,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
      scheduledStart: liveClassSessions.scheduledStart,
      scheduledEnd: liveClassSessions.scheduledEnd,
      actualStart: liveClassSessions.actualStart,
      actualEnd: liveClassSessions.actualEnd,
      providerMeetingId: liveClassSessions.providerMeetingId,
      creatorUserId: liveClassSessions.creatorUserId,
      createdAt: liveClassSessions.createdAt,
    })
    .from(liveClassSessions)
    .leftJoin(liveClassProviderProfiles, eq(liveClassSessions.providerProfileId, liveClassProviderProfiles.id))
    .leftJoin(user, eq(liveClassSessions.teacherUserId, user.id))
    .leftJoin(classSections, eq(liveClassSessions.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .leftJoin(classSubjects, eq(liveClassSessions.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(and(...where))
    .orderBy(desc(liveClassSessions.scheduledStart))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows: rows as SessionListRow[], total, page, pageSize };
}

export type SessionDetail = {
  session: LiveClassSessionRow;
  teacherName: string | null;
  profileName: string | null;
  providerType: string | null;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  invitations: Array<{
    id: string;
    userId: string;
    participantRole: string;
    joinEligible: boolean;
    deliveryState: string;
    userName: string | null;
  }>;
  events: Array<{
    id: string;
    providerEventId: string;
    userId: string | null;
    externalParticipantId: string | null;
    participantRole: string | null;
    eventType: string;
    providerTimestamp: string;
    processingStatus: string;
  }>;
};

export async function getSessionDetail(
  tenantId: string,
  sessionId: string,
  opts?: { actorRole?: string; actorUserId?: string },
): Promise<SessionDetail> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  // Audience restriction: a teacher may only open their own sessions.
  if (opts?.actorRole === 'teacher' && opts.actorUserId !== session.teacherUserId) {
    throw new ApiError(403, 'TEACHER_SCOPE', 'Vous ne pouvez consulter que vos propres classes virtuelles.');
  }

  const [meta] = await db
    .select({
      teacherName: user.name,
      profileName: liveClassProviderProfiles.name,
      providerType: liveClassProviderProfiles.providerType,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
    })
    .from(liveClassSessions)
    .leftJoin(liveClassProviderProfiles, eq(liveClassSessions.providerProfileId, liveClassProviderProfiles.id))
    .leftJoin(user, eq(liveClassSessions.teacherUserId, user.id))
    .leftJoin(classSections, eq(liveClassSessions.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .leftJoin(classSubjects, eq(liveClassSessions.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(eq(liveClassSessions.id, sessionId))
    .limit(1);

  const invitations = await db
    .select({
      id: liveClassInvitations.id,
      userId: liveClassInvitations.userId,
      participantRole: liveClassInvitations.participantRole,
      joinEligible: liveClassInvitations.joinEligible,
      deliveryState: liveClassInvitations.deliveryState,
      userName: user.name,
    })
    .from(liveClassInvitations)
    .leftJoin(user, eq(liveClassInvitations.userId, user.id))
    .where(eq(liveClassInvitations.sessionId, sessionId))
    .orderBy(desc(liveClassInvitations.createdAt));

  const events = await db
    .select({
      id: liveClassParticipantEvents.id,
      providerEventId: liveClassParticipantEvents.providerEventId,
      userId: liveClassParticipantEvents.userId,
      externalParticipantId: liveClassParticipantEvents.externalParticipantId,
      participantRole: liveClassParticipantEvents.participantRole,
      eventType: liveClassParticipantEvents.eventType,
      providerTimestamp: liveClassParticipantEvents.providerTimestamp,
      processingStatus: liveClassParticipantEvents.processingStatus,
    })
    .from(liveClassParticipantEvents)
    .where(eq(liveClassParticipantEvents.sessionId, sessionId))
    .orderBy(desc(liveClassParticipantEvents.providerTimestamp));

  return {
    session,
    teacherName: meta?.teacherName ?? null,
    profileName: meta?.profileName ?? null,
    providerType: meta?.providerType ?? null,
    className: meta?.className ?? null,
    sectionName: meta?.sectionName ?? null,
    subjectName: meta?.subjectName ?? null,
    invitations,
    events,
  };
}
