// ---------------------------------------------------------------------------
// Parent Portal — effective guardian relationship resolver.
//
// The single authorization gate for every /api/guardian/** route. The Role
// Portals Foundation primitives (isGuardianOfStudent / hasGuardianIdentity)
// treat ANY guardians.userId → guardian_students.studentId row as valid; this
// feature-local resolver adds the *effective* dimension — relationship status,
// effective dates, per-child access rights, financial responsibility, custody
// restrictions and the child's own account state. Deny by default: any
// relationship that does not resolve to an effective link is a 404 (never a
// distinguishing 403, so a caller cannot probe whether another child exists).
// ---------------------------------------------------------------------------

import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { guardians, guardianStudents, user } from '@/models/Schema';

export type RelationshipRights = {
  academic: boolean;
  attendance: boolean;
  finance: boolean;
  medical: boolean;
  communication: boolean;
};

/** The subset of rights a single request may demand. */
export type RequiredRights = Partial<RelationshipRights>;

export type EffectiveChild = {
  relationshipId: string;
  studentId: string;
  name: string;
  matricule: string | null;
  className: string | null;
  level: string | null;
  rights: RelationshipRights;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  hasPickupAuthority: boolean;
  isFinanciallyResponsible: boolean;
  custodyRestriction: string | null;
  sensitiveContactHidden: boolean;
};

export type RelationshipAuth = {
  relationshipId: string;
  guardianId: string;
  studentId: string;
  rights: RelationshipRights;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  hasPickupAuthority: boolean;
  isFinanciallyResponsible: boolean;
  custodyRestriction: string | null;
  sensitiveContactHidden: boolean;
};

export type GuardianIdentity = {
  guardianId: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

/** The authenticated account's guardian entity for a tenant, or null. */
export async function resolveGuardianIdentity(
  tenantId: string,
  guardianUserId: string,
): Promise<GuardianIdentity | null> {
  const [row] = await db
    .select({
      id: guardians.id,
      userId: guardians.userId,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
      email: guardians.email,
      phone: guardians.phone,
    })
    .from(guardians)
    .where(and(eq(guardians.tenantId, tenantId), eq(guardians.userId, guardianUserId)))
    .limit(1);
  return row
    ? { guardianId: row.id, userId: row.userId, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone }
    : null;
}

/** Pure effective-state predicate — unit-tested. */
export function isRelationshipEffective(status: string, effectiveFrom: string | null, effectiveTo: string | null): boolean {
  const now = Date.now();
  if (status !== 'active') return false;
  if (effectiveFrom && new Date(effectiveFrom).getTime() > now) return false;
  if (effectiveTo && new Date(effectiveTo).getTime() <= now) return false;
  return true;
}

function toRights(r: {
  canAccessAcademic: boolean;
  canAccessAttendance: boolean;
  canAccessFinance: boolean;
  canAccessMedical: boolean;
  canAccessCommunication: boolean;
}): RelationshipRights {
  return {
    academic: r.canAccessAcademic,
    attendance: r.canAccessAttendance,
    finance: r.canAccessFinance,
    medical: r.canAccessMedical,
    communication: r.canAccessCommunication,
  };
}

/**
 * The authoritative "my children" list: effective active relationships to live
 * student accounts. This is what the child switcher renders and what every
 * relationship-scoped query is bounded by.
 */
export async function resolveEffectiveChildren(
  tenantId: string,
  guardianUserId: string,
): Promise<EffectiveChild[]> {
  const identity = await resolveGuardianIdentity(tenantId, guardianUserId);
  if (!identity) {
    return [];
  }

  const rows = await db
    .select({
      relationshipId: guardianStudents.id,
      studentId: guardianStudents.studentId,
      status: guardianStudents.status,
      effectiveFrom: guardianStudents.effectiveFrom,
      effectiveTo: guardianStudents.effectiveTo,
      canAccessAcademic: guardianStudents.canAccessAcademic,
      canAccessAttendance: guardianStudents.canAccessAttendance,
      canAccessFinance: guardianStudents.canAccessFinance,
      canAccessMedical: guardianStudents.canAccessMedical,
      canAccessCommunication: guardianStudents.canAccessCommunication,
      isFinanciallyResponsible: guardianStudents.isFinanciallyResponsible,
      hasPickupAuthority: guardianStudents.hasPickupAuthority,
      custodyRestriction: guardianStudents.custodyRestriction,
      sensitiveContactHidden: guardianStudents.sensitiveContactHidden,
      isPrimaryContact: guardianStudents.isPrimaryContact,
      isEmergencyContact: guardianStudents.isEmergencyContact,
      canPickup: guardianStudents.canPickup,
      name: user.name,
      matricule: user.matricule,
      className: user.className,
      level: user.level,
      studentStatus: user.userStatus,
    })
    .from(guardianStudents)
    .innerJoin(user, eq(guardianStudents.studentId, user.id))
    .where(and(
      eq(guardianStudents.guardianId, identity.guardianId),
      eq(guardianStudents.tenantId, tenantId),
    ))
    .orderBy(guardianStudents.isPrimaryContact, guardianStudents.id);

  return rows
    .filter((r) => isRelationshipEffective(r.status, r.effectiveFrom, r.effectiveTo) && r.studentStatus === 'active')
    .map((r) => ({
      relationshipId: r.relationshipId,
      studentId: r.studentId,
      name: r.name,
      matricule: r.matricule,
      className: r.className,
      level: r.level,
      rights: toRights(r),
      isPrimaryContact: r.isPrimaryContact,
      isEmergencyContact: r.isEmergencyContact,
      canPickup: r.canPickup,
      hasPickupAuthority: r.hasPickupAuthority,
      isFinanciallyResponsible: r.isFinanciallyResponsible,
      custodyRestriction: r.custodyRestriction,
      sensitiveContactHidden: r.sensitiveContactHidden,
    }));
}

/**
 * Resolve an effective relationship by its scope key (guardian_students.id) and
 * return its auth record, or throw 404 — uniformly, without confirming whether
 * another child exists. Callers then use `requireRights` for data-specific gating.
 */
export async function assertRelationshipAccess(
  tenantId: string,
  guardianUserId: string,
  relationshipId: string,
): Promise<RelationshipAuth> {
  const identity = await resolveGuardianIdentity(tenantId, guardianUserId);
  if (!identity) {
    throw notAuthorized();
  }

  const [row] = await db
    .select({
      id: guardianStudents.id,
      guardianId: guardianStudents.guardianId,
      studentId: guardianStudents.studentId,
      status: guardianStudents.status,
      effectiveFrom: guardianStudents.effectiveFrom,
      effectiveTo: guardianStudents.effectiveTo,
      canAccessAcademic: guardianStudents.canAccessAcademic,
      canAccessAttendance: guardianStudents.canAccessAttendance,
      canAccessFinance: guardianStudents.canAccessFinance,
      canAccessMedical: guardianStudents.canAccessMedical,
      canAccessCommunication: guardianStudents.canAccessCommunication,
      isFinanciallyResponsible: guardianStudents.isFinanciallyResponsible,
      hasPickupAuthority: guardianStudents.hasPickupAuthority,
      custodyRestriction: guardianStudents.custodyRestriction,
      sensitiveContactHidden: guardianStudents.sensitiveContactHidden,
      isPrimaryContact: guardianStudents.isPrimaryContact,
      isEmergencyContact: guardianStudents.isEmergencyContact,
      canPickup: guardianStudents.canPickup,
    })
    .from(guardianStudents)
    .where(and(
      eq(guardianStudents.id, relationshipId),
      eq(guardianStudents.guardianId, identity.guardianId),
      eq(guardianStudents.tenantId, tenantId),
    ))
    .limit(1);

  if (!row || !isRelationshipEffective(row.status, row.effectiveFrom, row.effectiveTo)) {
    throw notAuthorized();
  }

  const [student] = await db
    .select({ status: user.userStatus })
    .from(user)
    .where(eq(user.id, row.studentId))
    .limit(1);
  if (!student || student.status !== 'active') {
    throw notAuthorized();
  }

  return {
    relationshipId: row.id,
    guardianId: row.guardianId,
    studentId: row.studentId,
    rights: toRights(row),
    isPrimaryContact: row.isPrimaryContact,
    isEmergencyContact: row.isEmergencyContact,
    canPickup: row.canPickup,
    hasPickupAuthority: row.hasPickupAuthority,
    isFinanciallyResponsible: row.isFinanciallyResponsible,
    custodyRestriction: row.custodyRestriction,
    sensitiveContactHidden: row.sensitiveContactHidden,
  };
}

/** 403 when a requested right is not granted on an otherwise-effective link. */
export function requireRights(auth: RelationshipAuth, required: RequiredRights): void {
  const denied = (Object.keys(required) as (keyof RelationshipRights)[]).find(
    (k) => required[k] && !auth.rights[k],
  );
  if (denied) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé pour cet enfant.');
  }
}

export function notAuthorized(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Enfant introuvable.');
}

/** A convenience guard for routes keyed by relationship id. */
export async function requireRelationship(
  ctx: { tenantId: string | null; userId: string },
  relationshipId: string,
  required?: RequiredRights,
): Promise<RelationshipAuth> {
  if (!ctx.tenantId) {
    throw notAuthorized();
  }
  const auth = await assertRelationshipAccess(ctx.tenantId, ctx.userId, relationshipId);
  if (required) {
    requireRights(auth, required);
  }
  return auth;
}
