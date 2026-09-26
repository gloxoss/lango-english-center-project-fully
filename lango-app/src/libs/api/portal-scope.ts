import { and, eq } from 'drizzle-orm';
import type { AnyColumn, SQL } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { branches, guardians, guardianStudents, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Portal authorization primitives — deny by default.
//
// Every portal route combines a capability check (permissions.ts) with a scope
// check from here. Page guards and API handlers must enforce the SAME
// effective access; these helpers are the shared vocabulary so they can't
// drift apart. A helper that does not explicitly grant access returns denial.
// ---------------------------------------------------------------------------

export function requireTenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  }
  return ctx.tenantId;
}

/** Deny unless the target resource is owned by the authenticated actor. */
export function assertSelf(ctx: RequestContext, resourceUserId: string): void {
  if (ctx.userId !== resourceUserId) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
  }
}

/**
 * Deny unless the resource branch matches the active branch. When no branch is
 * active on the context, branch-agnostic access is allowed (the tenant is the
 * boundary); when a branch IS active, cross-branch access is denied.
 */
export function assertBranchScope(ctx: RequestContext | null | undefined, resourceBranchId: string | null): void {
  if (ctx?.branchId && resourceBranchId !== null && ctx.branchId !== resourceBranchId) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé : filiale différente.');
  }
}

/**
 * Branch filter for scoped lists/counts/exports, next to the tenant filter:
 * `and(eq(t.tenantId, tenantId), branchWhere(ctx, t.branchId))`. Returns
 * `undefined` when no branch is active on the context (drizzle's `and()`
 * ignores undefined), so "Tous les sites" means no branch predicate at all.
 * The ONLY way a route may turn ctx.branchId into a WHERE term.
 */
export function branchWhere(ctx: RequestContext | null | undefined, column: AnyColumn): SQL | undefined {
  return ctx?.branchId ? eq(column, ctx.branchId) : undefined;
}

/**
 * Branch validation for writes (creates, moves, updates that set a branch).
 * The branch must be an active branch of the caller's tenant, and a
 * branch-locked principal may never write into another one (a null branchId
 * is also refused for them: locked staff always write into their own campus).
 * Returns nothing; throws 403 otherwise. DB4 (an explicit campus is required
 * when "Tous les sites" is selected) stays the caller's decision.
 */
export async function assertWritableBranch(
  ctx: RequestContext | null | undefined,
  branchId: string | null | undefined,
): Promise<void> {
  if (!ctx) {
    return;
  }
  if (ctx.branchLocked && branchId !== ctx.branchId) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé : campus imposé pour ce compte.');
  }
  if (!branchId) {
    return;
  }
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.id, branchId),
        eq(branches.tenantId, requireTenantId(ctx)),
        eq(branches.isActive, true),
      ),
    )
    .limit(1);
  if (!branch) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé : campus invalide ou non autorisé.');
  }
}

/**
 * Detail-read/write gate for student-owned rows (documents, excuses, flags,
 * transfers, cards...): loads the student's campus inside the tenant and
 * applies the branch lock to it. Returns `{ exists: false }` when the student
 * does not exist — a missing row is the caller's 404, a branch lock never
 * invents one. A branchless student is `exists: true, branchId: null`.
 */
export async function assertStudentBranchScope(
  ctx: RequestContext,
  studentId: string,
  tenantId: string,
): Promise<{ exists: boolean; branchId: string | null }> {
  const [row] = await db
    .select({ branchId: user.branchId })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);
  if (!row) {
    return { exists: false, branchId: null };
  }
  assertBranchScope(ctx, row.branchId);
  return { exists: true, branchId: row.branchId };
}

/**
 * Relationship scope: is `guardianUserId` a linked guardian of `studentId` in
 * this tenant? This is the boundary that lets a parent see ONLY their linked
 * children — never an arbitrary student id.
 */
export async function isGuardianOfStudent(
  tenantId: string,
  guardianUserId: string,
  studentId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: guardianStudents.id })
    .from(guardians)
    .innerJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
    .where(
      and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.userId, guardianUserId),
        eq(guardianStudents.studentId, studentId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Deny unless the actor is a linked guardian of the given student. Callers pass
 * the student id from their own request/query — this re-verifies it against the
 * relationship table so an arbitrary foreign id is always refused.
 */
export async function assertGuardianOfStudent(
  ctx: RequestContext,
  studentId: string,
): Promise<void> {
  const tenantId = requireTenantId(ctx);
  if (!(await isGuardianOfStudent(tenantId, ctx.userId, studentId))) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
  }
}

/**
 * Deny unless the predicate grants access. The generic last resort for
 * relationship rules that don't have a dedicated helper yet — still fail-closed.
 */
export function denyUnless(condition: boolean): void {
  if (!condition) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
  }
}
