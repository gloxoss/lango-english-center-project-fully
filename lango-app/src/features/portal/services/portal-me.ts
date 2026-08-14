import { eq } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { getEffectivePermissions } from '@/libs/api/permissions';
import { tenants } from '@/models/Schema';
import { listAvailableRoles } from './active-context';

// ---------------------------------------------------------------------------
// Portal "me" payload — server-derived actor/tenant/active-role. Field set is
// fixed and redacted: no phone, no internal tenant fields beyond the name, no
// role-derived secrets. `permissions` is the granted-key projection of the
// *effective* role so the client never computes authorization.
// ---------------------------------------------------------------------------

export async function getPortalMe(ctx: RequestContext) {
  const availableRoles = await listAvailableRoles(ctx.tenantId, ctx.baseRole, ctx.userId);

  let tenantName: string | null = null;
  if (ctx.tenantId) {
    const [t] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);
    tenantName = t?.name ?? null;
  }

  const permissions = await getEffectivePermissions(ctx.userId, ctx.tenantId ?? '', ctx.role);
  const grantedKeys = Object.entries(permissions).filter(([, granted]) => granted).map(([key]) => key);

  return {
    userId: ctx.userId,
    name: ctx.name,
    email: ctx.email,
    tenantId: ctx.tenantId,
    tenantName,
    branchId: ctx.branchId,
    role: ctx.role,
    baseRole: ctx.baseRole,
    availableRoles,
    permissions: grantedKeys,
  };
}
