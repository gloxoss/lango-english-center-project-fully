// Visitor invitation → approval → pass → visit lifecycle. Every foreign id in
// the body is re-verified WHERE id=? AND tenantId=?. Check-in / check-out are
// replay-safe (FOR UPDATE row lock + status transition guard); the second
// call returns an `already_processed` result and records an evidence row, never
// a double transition.
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { issueBadge } from '@/libs/api/badge-service';
import { user } from '@/models/Schema';
import {
  guardGates,
  guardVisits,
  guardVisitorInvitations,
} from '@/features/guard/models/guard-schema';
import { insertScanEvidence } from '@/features/guard/services/credential-adapter';

const HOST_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist'] as const;

function requireTenantId(context: RequestContext): string {
  if (!context.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  return context.tenantId;
}

function toVisit(row: typeof guardVisits.$inferSelect) {
  return {
    id: row.id,
    visitorFirstName: row.visitorFirstName,
    visitorLastName: row.visitorLastName,
    visitorPhone: row.visitorPhone,
    visitorEmail: row.visitorEmail,
    purpose: row.purpose,
    hostName: row.hostName,
    passNumber: row.passNumber,
    hasPass: row.badgeCredentialId !== null,
    status: row.status,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function listInvitations(context: RequestContext, opts: {
  status?: string | null;
  q?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const conditions = [eq(guardVisitorInvitations.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(guardVisitorInvitations.status, opts.status));
  if (opts.q && opts.q.length >= 3) {
    const term = `%${opts.q}%`;
    conditions.push(or(
      ilike(guardVisitorInvitations.visitorFirstName, term),
      ilike(guardVisitorInvitations.visitorLastName, term),
      ilike(guardVisitorInvitations.visitorPhone, term),
    )!);
  }

  const rows = await db
    .select({
      id: guardVisitorInvitations.id,
      visitorFirstName: guardVisitorInvitations.visitorFirstName,
      visitorLastName: guardVisitorInvitations.visitorLastName,
      visitorPhone: guardVisitorInvitations.visitorPhone,
      purpose: guardVisitorInvitations.purpose,
      hostId: guardVisitorInvitations.hostId,
      hostName: user.name,
      expectedDate: guardVisitorInvitations.expectedDate,
      expectedStart: guardVisitorInvitations.expectedStart,
      expectedEnd: guardVisitorInvitations.expectedEnd,
      status: guardVisitorInvitations.status,
      approvedAt: guardVisitorInvitations.approvedAt,
      createdAt: guardVisitorInvitations.createdAt,
    })
    .from(guardVisitorInvitations)
    .leftJoin(user, eq(guardVisitorInvitations.hostId, user.id))
    .where(and(...conditions))
    .orderBy(desc(guardVisitorInvitations.createdAt))
    .limit(20);

  return rows;
}

export async function createInvitation(context: RequestContext, input: {
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  purpose: string;
  hostId: string;
  expectedDate: string;
  expectedStart: string;
  expectedEnd: string;
}) {
  const tenantId = requireTenantId(context);

  const [host] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(and(eq(user.id, input.hostId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!host || !(HOST_ROLES as readonly string[]).includes(host.role)) {
    throw new ApiError(422, 'HOST_NOT_ALLOWED', 'L\'hôte doit être un membre de l\'établissement.');
  }

  const rows = await db
    .insert(guardVisitorInvitations)
    .values({
      tenantId,
      visitorFirstName: input.visitorFirstName,
      visitorLastName: input.visitorLastName,
      visitorPhone: input.visitorPhone ?? null,
      visitorEmail: input.visitorEmail ?? null,
      purpose: input.purpose,
      hostId: input.hostId,
      expectedDate: new Date(input.expectedDate).toISOString(),
      expectedStart: input.expectedStart,
      expectedEnd: input.expectedEnd,
      status: 'invited',
      createdById: context.userId,
    })
    .returning();

  const invitation = rows[0]!;
  recordAudit(context, 'create', 'guard_visitor_invitation', invitation.id);
  return invitation;
}

async function loadInvitationForOwner(tenantId: string, id: string, context: RequestContext) {
  const [invitation] = await db
    .select()
    .from(guardVisitorInvitations)
    .where(and(eq(guardVisitorInvitations.id, id), eq(guardVisitorInvitations.tenantId, tenantId)))
    .limit(1);
  if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation introuvable.');

  const isAdmin = context.role === 'school_admin' || context.role === 'super_admin';
  if (!isAdmin && invitation.hostId !== context.userId) {
    throw new ApiError(403, 'NOT_HOST', 'Seul l\'hôte ou un administrateur peut décider de cette invitation.');
  }
  return invitation;
}

export async function approveInvitation(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);
  const invitation = await loadInvitationForOwner(tenantId, id, context);
  if (invitation.status !== 'invited') {
    throw new ApiError(409, 'INVITATION_NOT_PENDING', 'Seules les invitations en attente peuvent être approuvées.');
  }
  const now = new Date().toISOString();
  const rows = await db
    .update(guardVisitorInvitations)
    .set({ status: 'approved', approvedById: context.userId, approvedAt: now, updatedAt: now })
    .where(and(eq(guardVisitorInvitations.id, id), eq(guardVisitorInvitations.tenantId, tenantId)))
    .returning();
  recordAudit(context, 'update', 'guard_visitor_invitation', id);
  return rows[0]!;
}

export async function rejectInvitation(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);
  const invitation = await loadInvitationForOwner(tenantId, id, context);
  if (invitation.status !== 'invited') {
    throw new ApiError(409, 'INVITATION_NOT_PENDING', 'Seules les invitations en attente peuvent être refusées.');
  }
  const now = new Date().toISOString();
  const rows = await db
    .update(guardVisitorInvitations)
    .set({ status: 'rejected', updatedAt: now })
    .where(and(eq(guardVisitorInvitations.id, id), eq(guardVisitorInvitations.tenantId, tenantId)))
    .returning();
  recordAudit(context, 'update', 'guard_visitor_invitation', id);
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Visits (walk-in + from invitation)
// ---------------------------------------------------------------------------

export async function listVisits(context: RequestContext, opts: {
  q?: string | null;
  status?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const conditions = [eq(guardVisits.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(guardVisits.status, opts.status));
  if (opts.q && opts.q.length >= 3) {
    const term = `%${opts.q}%`;
    conditions.push(or(
      ilike(guardVisits.visitorFirstName, term),
      ilike(guardVisits.visitorLastName, term),
      ilike(guardVisits.passNumber, term),
      ilike(guardVisits.visitorPhone, term),
    )!);
  }

  const rows = await db
    .select()
    .from(guardVisits)
    .where(and(...conditions))
    .orderBy(desc(guardVisits.createdAt))
    .limit(20);

  return rows.map(toVisit);
}

export async function createVisit(context: RequestContext, input: {
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  purpose: string;
  hostId?: string | null;
  invitationId?: string | null;
  approved: boolean;
}) {
  const tenantId = requireTenantId(context);

  let hostId: string | null = input.hostId ?? null;
  let hostName: string | null = null;
  let invitationId: string | null = input.invitationId ?? null;
  let status: 'pending' | 'approved' = input.approved ? 'approved' : 'pending';

  if (invitationId) {
    const [invitation] = await db
      .select()
      .from(guardVisitorInvitations)
      .where(and(eq(guardVisitorInvitations.id, invitationId), eq(guardVisitorInvitations.tenantId, tenantId)))
      .limit(1);
    if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation introuvable.');
    if (invitation.status !== 'approved') {
      throw new ApiError(409, 'INVITATION_NOT_APPROVED', 'L\'invitation doit être approuvée avant l\'arrivée.');
    }
    hostId = invitation.hostId;
    invitationId = invitation.id;
    status = 'approved';
    const [host] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, invitation.hostId))
      .limit(1);
    hostName = host?.name ?? null;
  } else if (hostId) {
    const [host] = await db
      .select({ name: user.name })
      .from(user)
      .where(and(eq(user.id, hostId), eq(user.tenantId, tenantId)))
      .limit(1);
    hostName = host?.name ?? null;
  }

  const rows = await db
    .insert(guardVisits)
    .values({
      tenantId,
      branchId: context.branchId,
      invitationId,
      visitorFirstName: input.visitorFirstName,
      visitorLastName: input.visitorLastName,
      visitorPhone: input.visitorPhone ?? null,
      visitorEmail: input.visitorEmail ?? null,
      purpose: input.purpose,
      hostId,
      hostName,
      status,
      createdById: context.userId,
    })
    .returning();

  const visit = rows[0]!;
  recordAudit(context, 'create', 'guard_visit', visit.id);
  return toVisit(visit);
}

// Replay-safe check-in. FOR UPDATE serializes concurrent calls; only the first
// transitions approved→checked_in. A repeat returns already_processed.
export async function checkInVisit(context: RequestContext, id: string, input: {
  gateId: string;
  idempotencyKey?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const now = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const [visit] = await tx
      .select()
      .from(guardVisits)
      .where(and(eq(guardVisits.id, id), eq(guardVisits.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!visit) throw new ApiError(404, 'VISIT_NOT_FOUND', 'Visite introuvable.');

    if (visit.status === 'checked_in') {
      return { replayed: true as const, checkInAt: visit.checkInAt };
    }
    if (visit.status !== 'approved') {
      throw new ApiError(409, 'VISIT_NOT_APPROVED', 'La visite doit être approuvée pour le pointage d\'entrée.');
    }

    await tx
      .update(guardVisits)
      .set({ status: 'checked_in', checkInAt: now, checkInBy: context.userId, gateId: input.gateId, updatedAt: now })
      .where(eq(guardVisits.id, id));
    return { replayed: false as const, checkInAt: now };
  });

  // Evidence is append-only and best-effort; a log failure must not roll back
  // the transition. Replays are recorded with a null idempotency key so the
  // partial unique index is never violated.
  await insertScanEvidence({
    tenantId,
    gateId: input.gateId,
    direction: 'entry',
    visitId: id,
    subjectType: 'visitor',
    resultStatus: result.replayed ? 'already_processed' : 'accepted',
    rejectionReason: result.replayed ? 'ALREADY_CHECKED_IN' : null,
    idempotencyKey: result.replayed ? null : (input.idempotencyKey ?? null),
    actorId: context.userId,
  });

  return { replayed: result.replayed, checkInAt: result.checkInAt };
}

// Replay-safe check-out (§6.4): checked_in→checked_out exactly once.
export async function checkOutVisit(context: RequestContext, id: string, input: {
  gateId: string;
  idempotencyKey?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const now = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const [visit] = await tx
      .select()
      .from(guardVisits)
      .where(and(eq(guardVisits.id, id), eq(guardVisits.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!visit) throw new ApiError(404, 'VISIT_NOT_FOUND', 'Visite introuvable.');

    if (visit.status === 'checked_out') {
      return { replayed: true as const, checkOutAt: visit.checkOutAt };
    }
    if (visit.status !== 'checked_in') {
      throw new ApiError(409, 'VISIT_NOT_CHECKED_IN', 'La visite doit être pointée à l\'entrée pour être libérée.');
    }

    await tx
      .update(guardVisits)
      .set({ status: 'checked_out', checkOutAt: now, checkOutBy: context.userId, gateId: input.gateId, updatedAt: now })
      .where(eq(guardVisits.id, id));
    return { replayed: false as const, checkOutAt: now };
  });

  await insertScanEvidence({
    tenantId,
    gateId: input.gateId,
    direction: 'exit',
    visitId: id,
    subjectType: 'visitor',
    resultStatus: result.replayed ? 'already_processed' : 'accepted',
    rejectionReason: result.replayed ? 'ALREADY_CHECKED_OUT' : null,
    idempotencyKey: result.replayed ? null : (input.idempotencyKey ?? null),
    actorId: context.userId,
  });

  return { replayed: result.replayed, checkOutAt: result.checkOutAt };
}

// Visitor pass issuance — one shared signed badge via badge-service. Each visit
// owns a dedicated visitor user row so issueBadge's one-active-badge-per-user
// revoke never revokes another visitor's pass.
export async function issueVisitorPass(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);

  const [visit] = await db
    .select()
    .from(guardVisits)
    .where(and(eq(guardVisits.id, id), eq(guardVisits.tenantId, tenantId)))
    .limit(1);
  if (!visit) throw new ApiError(404, 'VISIT_NOT_FOUND', 'Visite introuvable.');
  if (visit.status !== 'approved') {
    throw new ApiError(409, 'VISIT_NOT_APPROVED', 'Un pass ne peut être émis que pour une visite approuvée.');
  }
  if (visit.badgeCredentialId) {
    throw new ApiError(409, 'PASS_ALREADY_ISSUED', 'Un pass a déjà été émis pour cette visite.');
  }

  const visitorUserId = `VST-${visit.id}`;
  await db
    .insert(user)
    .values({
      id: visitorUserId,
      tenantId,
      name: `${visit.visitorFirstName} ${visit.visitorLastName}`.trim(),
      email: `${visitorUserId.toLowerCase()}@schoolos.ma`,
      role: 'parent',
    })
    .onConflictDoNothing({ target: user.id });

  const { badge, rawToken } = await issueBadge({
    tenantId,
    userId: visitorUserId,
    subjectType: 'visitor',
    issuerId: context.userId,
  });

  await db
    .update(guardVisits)
    .set({ badgeCredentialId: badge.id, updatedAt: new Date().toISOString() })
    .where(and(eq(guardVisits.id, id), eq(guardVisits.tenantId, tenantId)));

  recordAudit(context, 'create', 'identity_badge', badge.id, { visitId: id });
  return { visitId: id, badgeId: badge.id, rawToken };
}

// Used by the release flow to confirm a gate belongs to the tenant.
export async function requireTenantGate(tenantId: string, gateId: string) {
  const [gate] = await db
    .select({ id: guardGates.id, isActive: guardGates.isActive })
    .from(guardGates)
    .where(and(eq(guardGates.id, gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  if (!gate || !gate.isActive) throw new ApiError(403, 'GATE_INVALID', 'Portail invalide.');
  return gate;
}
