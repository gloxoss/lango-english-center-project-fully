import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/libs/auth';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import { APP_ROLES, type AppRole } from '@/libs/api/context';
import { resolveActiveContext } from '@/features/portal/services/active-context';

export type ServerUserContext = {
  userId: string;
  tenantId: string | null;
  branchId: string | null;
  role: AppRole;
  baseRole: AppRole;
  name: string | null;
  email: string | null;
  sessionId: string | null;
};

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Server-component twin of `requireRequestContext` (which needs a `Request`).
 * Returns the authenticated, active principal's context or `null` when the
 * request is unauthenticated, the account is disabled, or the tenant is
 * inactive. Callers that require a tenant should redirect/handle `null`.
 */
export async function getServerUserContext(): Promise<ServerUserContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return null;
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

  if (!principal || !isAppRole(principal.role)) {
    return null;
  }
  if (principal.role !== 'super_admin' && (!principal.tenantId || !principal.tenantActive)) {
    return null;
  }

  const sessionId = session.session?.id ?? null;
  const activeCtx = await resolveActiveContext(sessionId, {
    id: principal.id,
    tenantId: principal.tenantId,
    baseRole: principal.role,
    branchId: principal.branchId,
  });

  return {
    userId: principal.id,
    tenantId: principal.tenantId,
    branchId: activeCtx?.activeBranchId ?? principal.branchId,
    role: activeCtx?.activeRole ?? principal.role,
    baseRole: principal.role,
    name: principal.name,
    email: principal.email,
    sessionId,
  };
}
