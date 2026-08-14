// Pickup authorization + release. A release consumes an authorization exactly
// once: FOR UPDATE row lock serializes concurrent calls, the partial unique
// index on guardReleaseEvents(authorizationId) is the DB backstop, and the
// consumed status fails a replay. Release evidence is an immutable snapshot —
// never a credential secret.
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { guardianStudents, guardians, user } from '@/models/Schema';
import {
  guardPickupAuthorizations,
  guardReleaseEvents,
} from '@/features/guard/models/guard-schema';
import { insertScanEvidence } from '@/features/guard/services/credential-adapter';
import { requireTenantGate } from '@/features/guard/services/visitors-service';

function requireTenantId(context: RequestContext): string {
  if (!context.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  return context.tenantId;
}

async function requireTenantStudent(tenantId: string, studentId: string) {
  const [student] = await db
    .select({ id: user.id, name: user.name, matricule: user.matricule })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);
  return student ?? null;
}

// ---------------------------------------------------------------------------
// Narrow student search (§7.3): name (min 3), phone (min 6), or exact
// matricule. Capped at 20. Identity-minimized projection: id, matricule, name.
// ---------------------------------------------------------------------------
export async function searchStudents(context: RequestContext, q: string) {
  const tenantId = requireTenantId(context);
  const term = `%${q}%`;
  const conds = [
    ilike(user.name, term),
    eq(user.matricule, q),
  ];
  if (q.length >= 6) conds.push(ilike(user.phone, term));

  const rows = await db
    .select({ id: user.id, matricule: user.matricule, name: user.name })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      eq(user.userStatus, 'active'),
      or(...conds)!,
    ))
    .limit(20);

  return rows;
}

// §7.1 projection: student summary + authorized pickup persons (never class,
// grades, finance, medical, or the full guardian directory).
export async function listStudentPickups(context: RequestContext, studentId: string) {
  const tenantId = requireTenantId(context);
  const student = await requireTenantStudent(tenantId, studentId);
  if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable.');

  const linked = await db
    .select({
      pickupPersonId: guardianStudents.guardianId,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
      relationshipType: guardianStudents.relationshipType,
      isPrimaryContact: guardianStudents.isPrimaryContact,
      isEmergencyContact: guardianStudents.isEmergencyContact,
      canPickup: guardianStudents.canPickup,
    })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
    .where(and(
      eq(guardianStudents.tenantId, tenantId),
      eq(guardianStudents.studentId, studentId),
    ))
    .orderBy(desc(guardianStudents.isPrimaryContact));

  const authorizations = await db
    .select()
    .from(guardPickupAuthorizations)
    .where(and(
      eq(guardPickupAuthorizations.tenantId, tenantId),
      eq(guardPickupAuthorizations.studentId, studentId),
      eq(guardPickupAuthorizations.status, 'active'),
    ));

  return {
    student: { id: student.id, matricule: student.matricule, name: student.name },
    pickups: linked.map(link => ({
      ...link,
      activeAuthorizations: authorizations
        .filter(a => a.pickupPersonId === link.pickupPersonId)
        .map(a => ({ id: a.id, authorizedFrom: a.authorizedFrom, authorizedUntil: a.authorizedUntil, reason: a.reason })),
    })),
  };
}

// Create an effective-dated, one-time pickup authorization. The pickup person
// must already be linked to the student as a guardian in this tenant.
export async function createPickupAuthorization(context: RequestContext, input: {
  studentId: string;
  pickupPersonId: string;
  relationshipType: string;
  authorizedFrom: string;
  authorizedUntil: string;
  reason?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const student = await requireTenantStudent(tenantId, input.studentId);
  if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable.');

  const [link] = await db
    .select({ id: guardianStudents.id })
    .from(guardianStudents)
    .where(and(
      eq(guardianStudents.tenantId, tenantId),
      eq(guardianStudents.guardianId, input.pickupPersonId),
      eq(guardianStudents.studentId, input.studentId),
    ))
    .limit(1);
  if (!link) {
    throw new ApiError(422, 'PICKUP_PERSON_NOT_LINKED', 'Cette personne n\'est pas liée à l\'élève.');
  }

  if (new Date(input.authorizedUntil).getTime() <= new Date(input.authorizedFrom).getTime()) {
    throw new ApiError(422, 'INVALID_WINDOW', 'La fin doit être postérieure au début.');
  }

  const rows = await db
    .insert(guardPickupAuthorizations)
    .values({
      tenantId,
      studentId: input.studentId,
      pickupPersonId: input.pickupPersonId,
      relationshipType: input.relationshipType,
      authorizedFrom: new Date(input.authorizedFrom).toISOString(),
      authorizedUntil: new Date(input.authorizedUntil).toISOString(),
      reason: input.reason ?? null,
      status: 'active',
      createdById: context.userId,
    })
    .returning();

  const auth = rows[0]!;
  recordAudit(context, 'create', 'guard_pickup_authorization', auth.id);
  return auth;
}

export async function listPickupAuthorizations(context: RequestContext, opts: {
  studentId?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const conditions = [eq(guardPickupAuthorizations.tenantId, tenantId)];
  if (opts.studentId) conditions.push(eq(guardPickupAuthorizations.studentId, opts.studentId));

  const rows = await db
    .select({
      id: guardPickupAuthorizations.id,
      studentId: guardPickupAuthorizations.studentId,
      studentName: user.name,
      pickupPersonId: guardPickupAuthorizations.pickupPersonId,
      relationshipType: guardPickupAuthorizations.relationshipType,
      authorizedFrom: guardPickupAuthorizations.authorizedFrom,
      authorizedUntil: guardPickupAuthorizations.authorizedUntil,
      reason: guardPickupAuthorizations.reason,
      status: guardPickupAuthorizations.status,
      consumedAt: guardPickupAuthorizations.consumedAt,
      createdAt: guardPickupAuthorizations.createdAt,
    })
    .from(guardPickupAuthorizations)
    .leftJoin(user, and(eq(guardPickupAuthorizations.studentId, user.id), eq(user.tenantId, tenantId)))
    .where(and(...conditions))
    .orderBy(desc(guardPickupAuthorizations.createdAt))
    .limit(100);

  return rows;
}

export async function cancelPickupAuthorization(context: RequestContext, id: string) {
  const tenantId = requireTenantId(context);
  const [auth] = await db
    .select()
    .from(guardPickupAuthorizations)
    .where(and(eq(guardPickupAuthorizations.id, id), eq(guardPickupAuthorizations.tenantId, tenantId)))
    .limit(1);
  if (!auth) throw new ApiError(404, 'AUTHORIZATION_NOT_FOUND', 'Autorisation introuvable.');
  if (auth.status === 'consumed') {
    throw new ApiError(409, 'AUTHORIZATION_CONSUMED', 'Une autorisation consommée ne peut pas être annulée.');
  }
  if (auth.status !== 'active') {
    throw new ApiError(409, 'AUTHORIZATION_NOT_ACTIVE', 'Seule une autorisation active peut être annulée.');
  }

  const now = new Date().toISOString();
  await db
    .update(guardPickupAuthorizations)
    .set({ status: 'cancelled', updatedAt: now })
    .where(and(eq(guardPickupAuthorizations.id, id), eq(guardPickupAuthorizations.tenantId, tenantId)));
  recordAudit(context, 'update', 'guard_pickup_authorization', id);
}

// Replay-safe release. The row lock serializes concurrent releases; exactly one
// wins. A replay (fresh key against a consumed authorization) fails generically.
export async function releaseStudent(context: RequestContext, input: {
  studentId: string;
  authorizationId: string;
  method: 'badge_qr' | 'manual';
  gateId: string;
  deviceId?: string | null;
  kioskSessionId?: string | null;
  idempotencyKey?: string | null;
}) {
  const tenantId = requireTenantId(context);
  await requireTenantGate(tenantId, input.gateId);

  const result = await db.transaction(async (tx) => {
    const [auth] = await tx
      .select()
      .from(guardPickupAuthorizations)
      .where(and(eq(guardPickupAuthorizations.id, input.authorizationId), eq(guardPickupAuthorizations.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!auth) throw new ApiError(404, 'AUTHORIZATION_NOT_FOUND', 'Autorisation introuvable.');
    if (auth.studentId !== input.studentId) {
      throw new ApiError(409, 'STUDENT_MISMATCH', 'Cette autorisation ne concerne pas cet élève.');
    }
    if (auth.status !== 'active') {
      throw new ApiError(409, 'AUTHORIZATION_NOT_ACTIVE', 'Autorisation non active.');
    }

    const now = new Date();
    const from = new Date(auth.authorizedFrom).getTime();
    const until = new Date(auth.authorizedUntil).getTime();
    if (now.getTime() < from || now.getTime() >= until) {
      throw new ApiError(409, 'AUTHORIZATION_EXPIRED', 'Autorisation hors fenêtre de validité.');
    }

    const [student] = await tx
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, input.studentId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable.');

    const [pickupPerson] = await tx
      .select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName })
      .from(guardians)
      .where(and(eq(guardians.id, auth.pickupPersonId), eq(guardians.tenantId, tenantId)))
      .limit(1);
    if (!pickupPerson) throw new ApiError(404, 'PICKUP_PERSON_NOT_FOUND', 'Personne autorisée introuvable.');

    const releasedAt = now.toISOString();
    await tx.insert(guardReleaseEvents).values({
      tenantId,
      studentId: input.studentId,
      authorizationId: auth.id,
      releaseMethod: input.method,
      operatorId: context.userId,
      gateId: input.gateId,
      deviceId: input.deviceId ?? null,
      kioskSessionId: input.kioskSessionId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      releasedAt,
      evidence: {
        student: { id: student.id, name: student.name },
        pickupPerson: {
          id: pickupPerson.id,
          firstName: pickupPerson.firstName,
          lastName: pickupPerson.lastName,
          relationshipType: auth.relationshipType,
        },
        method: input.method,
        direction: 'exit',
        gateId: input.gateId,
        releasedAt,
      },
    });

    await tx
      .update(guardPickupAuthorizations)
      .set({ status: 'consumed', consumedAt: releasedAt, updatedAt: releasedAt })
      .where(and(eq(guardPickupAuthorizations.id, auth.id), eq(guardPickupAuthorizations.tenantId, tenantId)));

    return { releasedAt, student, pickupPerson, relationshipType: auth.relationshipType };
  });

  // Best-effort evidence row for the evidence trail (append-only log).
  await insertScanEvidence({
    tenantId,
    gateId: input.gateId,
    deviceId: input.deviceId ?? null,
    kioskSessionId: input.kioskSessionId ?? null,
    direction: 'exit',
    subjectUserId: input.studentId,
    subjectType: 'student',
    resultStatus: 'released',
    idempotencyKey: null,
    actorId: context.userId,
  }).catch(() => undefined);

  recordAudit(context, 'create', 'guard_release_event', result.student.id, {
    authorizationId: input.authorizationId,
    method: input.method,
  });
  return result;
}
