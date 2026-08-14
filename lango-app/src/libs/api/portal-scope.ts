import { and, eq } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { guardians, guardianStudents } from '@/models/Schema';

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
export function assertBranchScope(ctx: RequestContext, resourceBranchId: string | null): void {
  if (ctx.branchId && resourceBranchId !== null && ctx.branchId !== resourceBranchId) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé : filiale différente.');
  }
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
