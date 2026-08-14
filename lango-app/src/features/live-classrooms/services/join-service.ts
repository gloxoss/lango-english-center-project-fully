// Just-in-time join authorization.
//
// A join is authorized per person, per session, at the moment it is requested:
//  - Window: only within [scheduledStart - grace, scheduledEnd].
//  - Identity: teachers host their own sessions; students/parents need an active
//    placement in the session's class section (or an explicit joinEligible
//    roster invitation); admins may join anything.
//  - Grant: a short-lived single-use HMAC token is issued and redeemed against
//    the provider. The redeem step rebinds the token to the authenticated user.
// No reusable public links are ever persisted.
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  classes, classSections, classSubjects,
  liveClassInvitations, liveClassJoinGrants, liveClassParticipantEvents,
  liveClassProviderProfiles, liveClassSessions, sections, studentPlacements, subjects, user,
} from '@/models/Schema';
import {
  createJoinGrant, getProviderOrThrow, hashJoinNonce, isJoinSigningConfigured,
  verifyJoinToken, type ProviderConfig,
} from '@/features/live-classrooms/providers';
import { loadSession, toLocalNaive } from './session-service';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { resolveEffectiveChildren } from '@/features/parent/services/relationship-resolver';

const JOIN_GRANT_TTL_SECONDS = 120;
const JOIN_GRACE_BEFORE_MS = 10 * 60 * 1000; // 10 minutes

export type JoinRole = 'moderator' | 'viewer';

export function isJoinableStatus(status: string): boolean {
  return status === 'scheduled' || status === 'waiting' || status === 'live';
}

function assertJoinWindow(session: typeof liveClassSessions.$inferSelect): void {
  const now = Date.now();
  const start = new Date(session.scheduledStart).getTime();
  const end = new Date(session.scheduledEnd).getTime();
  if (now < start - JOIN_GRACE_BEFORE_MS) {
    throw new ApiError(409, 'SESSION_JOIN_WINDOW_NOT_OPEN', 'La classe virtuelle n\'est pas encore ouverte à la connexion.');
  }
  if (now > end) {
    throw new ApiError(409, 'SESSION_JOIN_WINDOW_CLOSED', 'La fenêtre de connexion à la classe virtuelle est fermée.');
  }
}

function assertSessionJoinable(session: typeof liveClassSessions.$inferSelect): void {
  if (session.status === 'cancelled') throw new ApiError(409, 'SESSION_CANCELLED', 'Cette classe virtuelle a été annulée.');
  if (session.status === 'ended') throw new ApiError(409, 'SESSION_ENDED', 'Cette classe virtuelle est terminée.');
  if (session.status === 'draft') throw new ApiError(409, 'SESSION_NOT_SCHEDULED', 'Cette classe virtuelle est encore en brouillon.');
  if (session.status === 'failed') throw new ApiError(409, 'SESSION_FAILED', 'Cette classe virtuelle a rencontré une erreur et doit être relancée.');
  if (session.status === 'expired') throw new ApiError(409, 'SESSION_EXPIRED', 'Cette classe virtuelle a expiré.');
  if (!isJoinableStatus(session.status)) {
    throw new ApiError(409, 'SESSION_NOT_JOINABLE', 'Cette classe virtuelle n\'est pas joignable pour le moment.');
  }
}

async function hasJoinEligibleInvitation(tenantId: string, sessionId: string, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: liveClassInvitations.id }).from(liveClassInvitations)
    .where(and(
      eq(liveClassInvitations.tenantId, tenantId),
      eq(liveClassInvitations.sessionId, sessionId),
      eq(liveClassInvitations.userId, userId),
      eq(liveClassInvitations.joinEligible, true),
    )).limit(1);
  return Boolean(row);
}

async function resolveStudentClassSectionIds(tenantId: string, studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const placements = await db
    .select({ classSectionId: studentPlacements.classSectionId })
    .from(studentPlacements)
    .where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.isCurrent, true),
      inArray(studentPlacements.studentId, studentIds),
    ));
  return placements.map(p => p.classSectionId);
}

// Effective guardian authorization (P1-3): a parent may act on behalf of a
// child in a live-classroom context only through an EFFECTIVE relationship —
// active status, within its effective date window, academic access granted,
// and not custody-restricted. This defers entirely to the parent portal's
// authoritative resolver (relationship-resolver.ts) so live-classrooms never
// re-implements — and can never drift from — that authorization surface.
// Revocation is immediate: every call re-reads the live relationship state.
async function resolveChildrenOfParent(tenantId: string, parentUserId: string): Promise<string[]> {
  const children = await resolveEffectiveChildren(tenantId, parentUserId);
  return children
    .filter(c => c.rights.academic && !c.custodyRestriction)
    .map(c => c.studentId);
}

async function assertCanJoin(
  ctx: RequestContext,
  tenantId: string,
  session: typeof liveClassSessions.$inferSelect,
): Promise<JoinRole> {
  const isAdmin = ctx.role === 'school_admin' || ctx.role === 'super_admin';
  const isHost = session.teacherUserId === ctx.userId;

  if (isAdmin) return 'moderator';
  if (isHost) return 'moderator';

  if (ctx.role === 'teacher') {
    // A non-host teacher may only join (as viewer) with an explicit invitation.
    const scoped = await getTeacherClassSectionIds(tenantId, ctx.userId);
    if (scoped.includes(session.classSectionId ?? '') || await hasJoinEligibleInvitation(tenantId, session.id, ctx.userId)) {
      return 'viewer';
    }
    throw new ApiError(403, 'TEACHER_SCOPE', 'Vous ne pouvez rejoindre que vos propres classes virtuelles.');
  }

  if (ctx.role === 'student') {
    const placedIn = await resolveStudentClassSectionIds(tenantId, [ctx.userId]);
    if (placedIn.includes(session.classSectionId ?? '') || await hasJoinEligibleInvitation(tenantId, session.id, ctx.userId)) {
      return 'viewer';
    }
    throw new ApiError(403, 'STUDENT_NOT_PLACED', 'Vous n\'êtes pas inscrit dans la classe de cette session.');
  }

  if (ctx.role === 'parent') {
    const children = await resolveChildrenOfParent(tenantId, ctx.userId);
    const placedIn = await resolveStudentClassSectionIds(tenantId, children);
    if (placedIn.includes(session.classSectionId ?? '') || await hasJoinEligibleInvitation(tenantId, session.id, ctx.userId)) {
      return 'viewer';
    }
    throw new ApiError(403, 'PARENT_NOT_LINKED', 'Aucun de vos enfants n\'est inscrit dans la classe de cette session.');
  }

  // Operational roles (accountant/receptionist/guard/alumni/librarian) hold no
  // live.* capability; this branch is defensive.
  throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez pas rejoindre cette classe virtuelle.');
}

export async function issueJoinGrant(ctx: RequestContext, tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertSessionJoinable(session);
  assertJoinWindow(session);
  const role = await assertCanJoin(ctx, tenantId, session);

  if (!isJoinSigningConfigured()) {
    throw new ApiError(500, 'JOIN_SIGNING_NOT_CONFIGURED', 'La signature des jetons de connexion n\'est pas configurée.');
  }

  // Issue + persist the grant atomically: the grant row exists (bound to
  // tenant/user/session/auth-session) if and only if a token is returned. Only
  // the nonce hash is stored — the raw nonce/token is never persisted.
  const grant = await db.transaction(async (tx) => {
    const g = createJoinGrant({
      userId: ctx.userId,
      tenantId,
      sessionId: session.id,
      role,
      ttlSeconds: JOIN_GRANT_TTL_SECONDS,
      authSessionId: ctx.sessionId ?? null,
    });
    await tx.insert(liveClassJoinGrants).values({
      tenantId,
      sessionId: session.id,
      userId: ctx.userId,
      authSessionId: ctx.sessionId ?? null,
      role,
      nonceHash: hashJoinNonce(g.nonce),
      expiresAt: toLocalNaive(new Date(g.expiresAt)),
    });
    return g;
  });

  return { token: grant.token, expiresAt: grant.expiresAt, role, sessionId: session.id };
}

export async function redeemJoinGrant(ctx: RequestContext, tenantId: string, sessionId: string, token: string) {
  const verification = verifyJoinToken(token);
  if (!verification.ok) {
    throw new ApiError(401, 'JOIN_GRANT_INVALID', `Jeton de connexion invalide: ${verification.reason}`);
  }
  const payload = verification.payload;
  if (payload.session !== sessionId) {
    throw new ApiError(403, 'JOIN_GRANT_SESSION_MISMATCH', 'Ce jeton de connexion ne correspond pas à cette session.');
  }
  if (payload.sub !== ctx.userId) {
    throw new ApiError(403, 'JOIN_GRANT_BINDING', 'Ce jeton de connexion appartient à un autre utilisateur.');
  }
  if (payload.tenant !== tenantId) {
    throw new ApiError(403, 'JOIN_GRANT_TENANT_MISMATCH', 'Ce jeton de connexion ne correspond pas à cet établissement.');
  }

  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  assertSessionJoinable(session);
  assertJoinWindow(session);
  if (!session.providerMeetingId) {
    throw new ApiError(409, 'SESSION_NO_ROOM', 'La salle fournisseur de cette session n\'est pas prête.');
  }

  const [profile] = await db.select().from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, session.providerProfileId), eq(liveClassProviderProfiles.tenantId, tenantId)))
    .limit(1);
  if (!profile) throw new ApiError(422, 'INVALID_REFERENCE', 'Le profil fournisseur de cette session est introuvable.');

  // Durable one-time redemption: the atomic UPDATE (redeemed_at IS NULL) means
  // concurrent redemptions resolve to exactly one winner across processes and
  // restarts. The app-join participant event is recorded in the same tx — no
  // network I/O happens inside it (the provider call is made after commit).
  const now = new Date();
  await db.transaction(async (tx) => {
    const consumed = await tx.update(liveClassJoinGrants)
      .set({ redeemedAt: toLocalNaive(now) })
      .where(and(
        eq(liveClassJoinGrants.tenantId, tenantId),
        eq(liveClassJoinGrants.sessionId, sessionId),
        eq(liveClassJoinGrants.userId, ctx.userId),
        eq(liveClassJoinGrants.nonceHash, hashJoinNonce(payload.nonce)),
        isNull(liveClassJoinGrants.redeemedAt),
        gt(liveClassJoinGrants.expiresAt, toLocalNaive(now)),
      ))
      .returning({ id: liveClassJoinGrants.id });
    if (consumed.length === 0) {
      throw new ApiError(401, 'JOIN_GRANT_REPLAYED', 'Ce jeton de connexion a déjà été utilisé ou a expiré.');
    }
    await tx.insert(liveClassParticipantEvents).values({
      tenantId,
      sessionId: session.id,
      providerEventId: `app-join:${session.id}:${ctx.userId}:${Date.now()}`,
      providerProfileId: session.providerProfileId,
      userId: ctx.userId,
      externalParticipantId: `dev-user-${ctx.userId}`,
      participantRole: payload.role,
      eventType: 'joined',
      providerTimestamp: now.toISOString(),
      rawPayload: { via: 'join-grant' },
      processingStatus: 'processed',
    });
  });

  const provider = getProviderOrThrow(profile.providerType);
  const config: ProviderConfig = { baseUrl: profile.baseUrl, accountId: profile.accountId };
  const join = await provider.createJoinToken({
    providerMeetingId: session.providerMeetingId,
    role: payload.role,
    identity: ctx.userId,
    displayName: ctx.name,
    ttlSeconds: JOIN_GRANT_TTL_SECONDS,
    config,
  });

  return {
    url: join.url,
    expiresAt: join.expiresAt,
    role: payload.role,
    providerType: profile.providerType,
  };
}

export type MySessionRow = {
  id: string;
  title: string;
  status: string;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  teacherName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  providerType: string | null;
  canJoin: boolean;
};

export async function listMySessions(ctx: RequestContext, tenantId: string): Promise<MySessionRow[]> {
  let classSectionIds: string[] = [];
  let teacherOnly: string | null = null;

  if (ctx.role === 'student') {
    classSectionIds = await resolveStudentClassSectionIds(tenantId, [ctx.userId]);
  } else if (ctx.role === 'parent') {
    const children = await resolveChildrenOfParent(tenantId, ctx.userId);
    classSectionIds = await resolveStudentClassSectionIds(tenantId, children);
  } else if (ctx.role === 'teacher') {
    teacherOnly = ctx.userId;
  }
  // school_admin / super_admin fall through with no filter (they see all via live.read).

  const filters = [
    eq(liveClassSessions.tenantId, tenantId),
    inArray(liveClassSessions.status, ['scheduled', 'waiting', 'live']),
  ];
  if (teacherOnly) {
    filters.push(eq(liveClassSessions.teacherUserId, teacherOnly));
  } else if (ctx.role === 'student' || ctx.role === 'parent') {
    if (classSectionIds.length === 0) return [];
    filters.push(inArray(liveClassSessions.classSectionId, classSectionIds));
  }

  const rows = await db
    .select({
      id: liveClassSessions.id,
      title: liveClassSessions.title,
      status: liveClassSessions.status,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
      teacherName: user.name,
      scheduledStart: liveClassSessions.scheduledStart,
      scheduledEnd: liveClassSessions.scheduledEnd,
      providerType: liveClassProviderProfiles.providerType,
    })
    .from(liveClassSessions)
    .leftJoin(liveClassProviderProfiles, eq(liveClassSessions.providerProfileId, liveClassProviderProfiles.id))
    .leftJoin(user, eq(liveClassSessions.teacherUserId, user.id))
    .leftJoin(classSections, eq(liveClassSessions.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .leftJoin(classSubjects, eq(liveClassSessions.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(and(...filters))
    .orderBy(liveClassSessions.scheduledStart);

  const now = Date.now();
  return rows.map(r => {
    const start = new Date(r.scheduledStart).getTime();
    const end = new Date(r.scheduledEnd).getTime();
    const canJoin = now >= start - JOIN_GRACE_BEFORE_MS && now <= end;
    return { ...r, canJoin };
  });
}
