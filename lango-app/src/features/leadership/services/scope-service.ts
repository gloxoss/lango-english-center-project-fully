import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { hasCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { branches } from '@/models/Schema';
import { departments } from '@/features/hr/models/hr-schema';
import { leadershipApprovalAuthorities, leadershipScopeAssignments } from '../models/leadership-schema';

export type LeadershipScope = {
  assignmentId: string | null;
  type: 'tenant' | 'branch' | 'department';
  branchId: string | null;
  departmentId: string | null;
};

export async function requireLeadershipScope(ctx: RequestContext): Promise<LeadershipScope> {
  if (!ctx.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');

  const permitted = await hasCapability(ctx.userId, ctx.tenantId, ctx.role, 'leadership.portal.use');
  if (!permitted) throw new ApiError(403, 'FORBIDDEN', 'Le profil direction est requis.');

  if (ctx.role === 'school_admin') {
    return { assignmentId: null, type: 'tenant', branchId: null, departmentId: null };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({
      id: leadershipScopeAssignments.id,
      type: leadershipScopeAssignments.scopeType,
      branchId: leadershipScopeAssignments.branchId,
      departmentId: leadershipScopeAssignments.departmentId,
    })
    .from(leadershipScopeAssignments)
    .leftJoin(branches, and(
      eq(branches.id, leadershipScopeAssignments.branchId),
      eq(branches.tenantId, ctx.tenantId),
    ))
    .leftJoin(departments, and(
      eq(departments.id, leadershipScopeAssignments.departmentId),
      eq(departments.tenantId, ctx.tenantId),
    ))
    .where(and(
      eq(leadershipScopeAssignments.tenantId, ctx.tenantId),
      eq(leadershipScopeAssignments.userId, ctx.userId),
      eq(leadershipScopeAssignments.status, 'active'),
      lte(leadershipScopeAssignments.startsOn, today),
      or(isNull(leadershipScopeAssignments.endsOn), gte(leadershipScopeAssignments.endsOn, today)),
    ))
    .limit(1);

  if (!row || !['tenant', 'branch', 'department'].includes(row.type)) {
    throw new ApiError(403, 'LEADERSHIP_SCOPE_REQUIRED', 'Aucun périmètre de direction actif.');
  }
  if (row.type === 'branch' && !row.branchId) throw new ApiError(403, 'LEADERSHIP_SCOPE_INVALID', 'Périmètre de filiale invalide.');
  if (row.type === 'department' && !row.departmentId) throw new ApiError(403, 'LEADERSHIP_SCOPE_INVALID', 'Périmètre de département invalide.');

  return {
    assignmentId: row.id,
    type: row.type as LeadershipScope['type'],
    branchId: row.branchId,
    departmentId: row.departmentId,
  };
}

export async function listActiveAuthorities(ctx: RequestContext, scope: LeadershipScope) {
  if (!ctx.tenantId || !scope.assignmentId) return [];
  const today = new Date().toISOString().slice(0, 10);
  return db.select({
    id: leadershipApprovalAuthorities.id,
    domain: leadershipApprovalAuthorities.domain,
    action: leadershipApprovalAuthorities.action,
    maxAmount: leadershipApprovalAuthorities.maxAmount,
    delegatedFromAuthorityId: leadershipApprovalAuthorities.delegatedFromAuthorityId,
    endsOn: leadershipApprovalAuthorities.endsOn,
  }).from(leadershipApprovalAuthorities).where(and(
    eq(leadershipApprovalAuthorities.tenantId, ctx.tenantId),
    eq(leadershipApprovalAuthorities.assignmentId, scope.assignmentId),
    eq(leadershipApprovalAuthorities.status, 'active'),
    lte(leadershipApprovalAuthorities.startsOn, today),
    or(isNull(leadershipApprovalAuthorities.endsOn), gte(leadershipApprovalAuthorities.endsOn, today)),
  ));
}
