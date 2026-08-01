import { and, eq } from 'drizzle-orm';
import { auth } from '@/libs/auth';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import { ApiError } from './errors';

export const APP_ROLES = ['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'parent', 'receptionist', 'guard'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type RequestContext = {
  userId: string;
  tenantId: string | null;
  branchId: string | null;
  role: AppRole;
  name: string;
  email: string;
};

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export async function requireRequestContext(
  request: Request,
  allowedRoles?: readonly AppRole[],
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
  if (allowedRoles && !allowedRoles.includes(principal.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Vous ne disposez pas des autorisations nécessaires.');
  }

  const url = new URL(request.url);
  const branchHeader = request.headers.get('x-branch-id');
  const branchQuery = url.searchParams.get('branchId');
  const activeBranchId = branchHeader || branchQuery || principal.branchId || null;

  return {
    userId: principal.id,
    tenantId: principal.tenantId,
    branchId: activeBranchId,
    role: principal.role,
    name: principal.name,
    email: principal.email,
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
