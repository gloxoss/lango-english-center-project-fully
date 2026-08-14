import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  branches,
  guardians,
  guardianStudents,
  portalActiveContexts,
  user as userTable,
} from '@/models/Schema';
import { APP_ROLES, type AppRole } from '@/libs/api/context';

// ---------------------------------------------------------------------------
// Server-owned active-role context.
//
// `user.role` stays the authoritative base role. An *active* role is stored in
// `portal_active_contexts` keyed by the Better-Auth session id — never in a
// browser cookie, localStorage, or query parameter. A row is created lazily on
// first portal request and updated only by POST /api/portal/role, which calls
// `assertRoleAssignable` here. Reads re-validate derived roles so a revoked
// identity (guardian link deleted) safely degrades back to the base role.
// ---------------------------------------------------------------------------

export type ResolvedActiveContext = {
  activeRole: AppRole;
  activeBranchId: string | null;
};

export type BasePrincipal = {
  id: string;
  tenantId: string | null;
  baseRole: AppRole;
  /** Authoritative branch assignment (user.branchId) — the only branch a stored
   *  context may legitimately reference until a multi-assignment table exists. */
  branchId: string | null;
};

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Does this user hold a real guardian identity linked to ≥1 **active** student?
 * The model has no soft-revoke or effective-date fields on the relationship
 * (hard delete is the only revocation), so the strongest enforceable binding is
 * that the linked student row is still `active` — a guardian of a deactivated
 * child loses the derived parent role.
 */
export async function hasGuardianIdentity(tenantId: string, userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [row] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .innerJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
    .innerJoin(userTable, eq(guardianStudents.studentId, userTable.id))
    .where(
      and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.userId, userId),
        eq(guardianStudents.tenantId, tenantId),
        eq(guardianStudents.status, 'active'),
        or(isNull(guardianStudents.effectiveFrom), lte(guardianStudents.effectiveFrom, now)),
        or(isNull(guardianStudents.effectiveTo), gt(guardianStudents.effectiveTo, now)),
        eq(userTable.tenantId, tenantId),
        eq(userTable.userStatus, 'active'),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The full set of roles this principal may legitimately activate: the base
 * role plus roles derivable from real identity rows (parent ← guardian link).
 */
export async function listAvailableRoles(tenantId: string | null, baseRole: AppRole, userId: string): Promise<AppRole[]> {
  const roles = new Set<AppRole>([baseRole]);
  if (tenantId && baseRole !== 'parent' && (await hasGuardianIdentity(tenantId, userId))) {
    roles.add('parent');
  }
  return [...roles];
}

/**
 * Server-side validation for a role switch. A role is switchable only when it
 * equals the base role or maps to a live derived identity. Returns false for
 * every other target so callers reply with one generic FORBIDDEN.
 */
export async function isRoleAssignable(tenantId: string | null, baseRole: AppRole, userId: string, targetRole: AppRole): Promise<boolean> {
  if (targetRole === baseRole) {
    return true;
  }
  if (baseRole === 'super_admin') {
    return false;
  }
  if (targetRole === 'parent' && tenantId) {
    return hasGuardianIdentity(tenantId, userId);
  }
  return false;
}

/**
 * Resolve the effective role/branch for a session. Returns the stored active
 * context only when it is still legitimate; otherwise returns null so callers
 * fall back to the base role (stale context is refused, never silently kept).
 */
export async function resolveActiveContext(
  sessionId: string | null,
  principal: BasePrincipal,
): Promise<ResolvedActiveContext | null> {
  const tenantId = principal.tenantId;
  if (!sessionId || !tenantId || principal.baseRole === 'super_admin') {
    return null;
  }

  const [row] = await db
    .select({
      userId: portalActiveContexts.userId,
      activeRole: portalActiveContexts.activeRole,
      activeBranchId: portalActiveContexts.activeBranchId,
      tenantId: portalActiveContexts.tenantId,
    })
    .from(portalActiveContexts)
    .where(eq(portalActiveContexts.sessionId, sessionId))
    .limit(1);

  // No stored context → caller falls back to the base role.
  if (!row) {
    return null;
  }

  // The stored context is bound to the authenticated user. A row whose
  // user_id, tenant, or role does not match this session's principal is a
  // forged/tampered row or a stale artifact — refuse it and drop it.
  if (row.userId !== principal.id || row.tenantId !== tenantId || !isAppRole(row.activeRole)) {
    await db.delete(portalActiveContexts).where(eq(portalActiveContexts.sessionId, sessionId)).catch(() => {});
    return null;
  }

  // Revalidate the stored branch against authoritative assignments. Until a
  // multi-assignment table exists, user.branchId is the only branch this
  // principal may reference, and the branch must still belong to the tenant.
  // A stale branch is cleared, never silently kept.
  let activeBranchId = row.activeBranchId;
  if (activeBranchId) {
    if (principal.branchId && activeBranchId === principal.branchId) {
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, activeBranchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (!branch) {
        activeBranchId = null;
      }
    } else {
      activeBranchId = null;
    }
  }

  if (!(await isRoleAssignable(tenantId, principal.baseRole, principal.id, row.activeRole))) {
    // Stale context (e.g. guardian link revoked). Drop the row so the next
    // request reads the base role immediately, then fall back.
    await db.delete(portalActiveContexts).where(eq(portalActiveContexts.sessionId, sessionId)).catch(() => {});
    return null;
  }

  // Persist a branch clear so the next read does not re-resolve a known-stale
  // value. Best-effort: a failed clear only re-runs the cheap revalidation.
  if (activeBranchId !== row.activeBranchId) {
    await db
      .update(portalActiveContexts)
      .set({ activeBranchId: activeBranchId ?? null, updatedAt: new Date().toISOString() })
      .where(eq(portalActiveContexts.sessionId, sessionId))
      .catch(() => {});
  }

  return {
    activeRole: row.activeRole,
    activeBranchId,
  };
}

/**
 * Persist a role switch after `isRoleAssignable` returned true. Upsert keyed
 * by sessionId; the tenant is re-checked against the principal's tenant so a
 * foreign session can never write into another tenant's context table.
 */
export async function persistActiveRole(
  sessionId: string,
  principal: BasePrincipal,
  activeRole: AppRole,
  activeBranchId: string | null,
): Promise<void> {
  if (!principal.tenantId) {
    throw new Error('Active context requires a tenant.');
  }
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: portalActiveContexts.id })
    .from(portalActiveContexts)
    .where(eq(portalActiveContexts.sessionId, sessionId))
    .limit(1);

  if (existing) {
    await db
      .update(portalActiveContexts)
      .set({
        activeRole,
        activeBranchId,
        tenantId: principal.tenantId,
        userId: principal.id,
        updatedAt: now,
      })
      .where(eq(portalActiveContexts.sessionId, sessionId));
  } else {
    await db.insert(portalActiveContexts).values({
      sessionId,
      userId: principal.id,
      tenantId: principal.tenantId,
      activeRole,
      activeBranchId,
      updatedAt: now,
    });
  }
}

/** Best-effort cleanup of a session's active context (e.g. on logout). */
export async function clearActiveContext(sessionId: string): Promise<void> {
  await db.delete(portalActiveContexts).where(eq(portalActiveContexts.sessionId, sessionId)).catch(() => {});
}
