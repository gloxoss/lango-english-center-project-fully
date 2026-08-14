import { redirect } from 'next/navigation';
import type { AppRole, RequestContext } from '@/libs/api/context';
import { requireServerPage } from '@/libs/api/page-guard';
import type { ServerUserContext } from '@/libs/auth/server-context';
import { requireLeadershipScope } from '../services/scope-service';

const ALL_ROLES: readonly AppRole[] = ['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'alumni', 'parent', 'receptionist', 'guard', 'librarian'];

function asRequestContext(ctx: ServerUserContext): RequestContext {
  return {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    role: ctx.role,
    baseRole: ctx.baseRole,
    name: ctx.name ?? '',
    email: ctx.email ?? '',
    sessionId: ctx.sessionId,
  };
}

/**
 * Server-component guard for the leadership portal.
 *
 * Access requires the `leadership.portal.use` capability (school_admins hold it
 * by default). Non-school_admin leaders must additionally hold an ACTIVE scope
 * assignment (tenant/branch/department) — the API routes reauthorize the same
 * way, so a page render without an active scope is never possible for them.
 *
 * `{ admin: true }` instead requires `leadership.scope.manage` (scopes &
 * authorities administration).
 */
export async function requireLeadershipPage(locale: string, opts: { admin?: boolean } = {}): Promise<void> {
  const ctx = await requireServerPage(locale, {
    allowedRoles: ALL_ROLES,
    requiredCapability: opts.admin ? 'leadership.scope.manage' : 'leadership.portal.use',
  });

  // super_admin has no tenant (cannot hold a scope); school_admins always hold
  // the tenant-wide scope. Everyone else must have an active assignment.
  if (ctx.role === 'super_admin' || ctx.role === 'school_admin') return;

  try {
    await requireLeadershipScope(asRequestContext(ctx));
  } catch {
    redirect(`/${locale}`);
  }
}
