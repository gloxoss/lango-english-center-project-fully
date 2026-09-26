import { and, eq } from 'drizzle-orm';
import { auth } from '@/libs/auth';
import { db } from '@/libs/DB';
import { isSubscriptionBlocked } from '@/libs/subscriptions/subscription-gate-logic';
import { tenants, user } from '@/models/Schema';
import { resolveActiveContext } from '@/features/portal/services/active-context';
import { ApiError } from './errors';

export const APP_ROLES = ['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'alumni', 'parent', 'receptionist', 'guard', 'librarian'] as const;
export type AppRole = (typeof APP_ROLES)[number];

// Patron roles are never branch-filtered: their context branch is always
// null, even with a stray user.branchId. Kept local (mirroring
// isPatronRole in features/portal/services/active-context) so suites that
// mock active-context with an explicit export list keep working.
function isPatronRole(role: AppRole): boolean {
  return role === 'parent' || role === 'student' || role === 'alumni';
}

export type RequestContext = {
  userId: string;
  tenantId: string | null;
  branchId: string | null;
  /** True when the principal is hard-locked to their assigned branch
   *  (user.branchId set, staff role). False for whole-school staff (who may
   *  choose a campus server-side), patrons and super-admin. Optional with
   *  default false so synthetic contexts (kiosks, workers, tests) that bypass
   *  requireRequestContext stay valid: absent means "not locked". The two
   *  real context builders always set it explicitly. */
  branchLocked?: boolean;
  role: AppRole;
  baseRole: AppRole;
  name: string;
  email: string;
  sessionId?: string | null;
  /** True when a super_admin is acting inside a selected tenant — audit rows written in this scope are marked (Law 09-08 / CNDP, audit 2026-09-22 P1-2). Set by requireRequestContext; defaults to false for hand-built contexts. */
  impersonated?: boolean;
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1].trim()) : null;
}

export async function requireRequestContext(
  request: Request,
  allowedRoles?: readonly AppRole[],
  opts?: { allowSuspended?: boolean },
): Promise<RequestContext> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentification requise.');
  }

  const [principal] = await db
    .select({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
      status: user.userStatus,
      name: user.name,
      email: user.email,
      tenantActive: tenants.isActive,
      tenantSubscriptionStatus: tenants.subscriptionStatus,
    })
    .from(user)
    .leftJoin(tenants, eq(user.tenantId, tenants.id))
    .where(and(eq(user.id, session.user.id), eq(user.userStatus, 'active')))
    .limit(1);

  if (!principal) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
  }
  if (!isAppRole(principal.role)) {
    throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'Ce rôle ne peut pas se connecter à cette application.');
  }
  if (principal.role !== 'super_admin' && (!principal.tenantId || !principal.tenantActive)) {
    throw new ApiError(403, 'TENANT_DISABLED', 'Cet établissement est indisponible.');
  }
  // Billing enforcement: a tenant whose subscription is suspended or cancelled
  // is blocked here (the same single choke point as isActive), except on the
  // self-service renewal endpoints which opt out via `allowSuspended`.
  if (
    principal.role !== 'super_admin' &&
    !opts?.allowSuspended &&
    isSubscriptionBlocked(principal.tenantSubscriptionStatus)
  ) {
    throw new ApiError(402, 'SUBSCRIPTION_SUSPENDED', 'Abonnement suspendu. Contactez votre administrateur.');
  }

  // Server-owned active-role context (Role Portals Foundation). Falls back to
  // the base role when no context row exists, so this is a no-op for every
  // existing caller until a role switch has been performed and validated.
  const sessionId = session.session?.id ?? null;
  const activeCtx = await resolveActiveContext(sessionId, {
    id: principal.id,
    tenantId: principal.tenantId,
    baseRole: principal.role,
    branchId: principal.branchId,
  });
  const effectiveRole = activeCtx?.activeRole ?? principal.role;

  let resolvedTenantId = principal.tenantId;
  const customTenantId = request.headers.get('x-tenant-id');

  if (effectiveRole === 'super_admin') {
    // Impersonation is server-owned: the ONLY path into a tenant scope is the
    // httpOnly cookie set by POST /api/super-admin/tenant-context (tenant
    // validated, audit row written, 8h expiry). The x-tenant-id header (set by
    // middleware for custom domains) and a ?tenantId= query param are IGNORED
    // for super admins — both previously bypassed the audited switch, so a
    // platform admin could read a school's data with no start row and no time
    // bound (visual audit pass 2; security audit P1-C).
    const cookieTenantId = getCookieValue(request, 'schoolos_active_tenant_id');
    resolvedTenantId =
      cookieTenantId && cookieTenantId !== 'none' && cookieTenantId !== 'all'
        ? cookieTenantId
        : null;
  } else if (customTenantId && principal.tenantId !== customTenantId) {
    throw new ApiError(403, 'FORBIDDEN', 'Accès refusé : Ce compte n\'appartient pas à cet établissement.');
  }

  const isRoleAllowed = !allowedRoles
    || allowedRoles.includes(effectiveRole)
    || (effectiveRole === 'super_admin' && resolvedTenantId !== null && allowedRoles.includes('school_admin'));

  if (!isRoleAllowed) {
    throw new ApiError(403, 'FORBIDDEN', 'Vous ne disposez pas des autorisations nécessaires.');
  }

  // Authoritative-only branch scope. resolveActiveContext has already
  // revalidated a stored active branch against user.branchId / the tenant's
  // active branches, so a stored branch is the only value that can differ
  // from the principal's. A client-supplied x-branch-id / ?branchId= is never
  // honored as a source: the branch comes from the server context, and a
  // client may only NARROW it where a route explicitly allows that.
  // Order matters: patrons never filter; a lock always confines (a stored
  // context cannot widen it); whole-school staff get their stored choice.
  const activeBranchId = isPatronRole(effectiveRole)
    ? null
    : principal.branchId ?? activeCtx?.activeBranchId ?? null;
  const branchLocked = activeCtx
    ? activeCtx.branchLocked
    : principal.branchId !== null && !isPatronRole(effectiveRole);

  return {
    userId: principal.id,
    tenantId: resolvedTenantId,
    branchId: activeBranchId,
    branchLocked,
    role: effectiveRole,
    baseRole: principal.role,
    name: principal.name,
    email: principal.email,
    sessionId,
    impersonated: effectiveRole === 'super_admin' && resolvedTenantId !== null,
  };
}

export function requireTenant(context: RequestContext): string {
  if (!context.tenantId) {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis pour cette opération.');
  }
  return context.tenantId;
}

// ponytail: super-admin routes are the one place in this app that
// deliberately do NOT call requireTenant - a super_admin has tenantId: null
// by design and must see/manage every tenant, not one.
export function requireSuperAdmin(context: RequestContext): void {
  if (context.role !== 'super_admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Réservé aux administrateurs de la plateforme.');
  }
}
