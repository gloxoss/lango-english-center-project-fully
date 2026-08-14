// Shared gate for broadcast add-on routes: authenticated session → tenant →
// add-on entitlement → capability. Every broadcast route must derive tenant and
// actor from the session (never from the body) and pass through this helper.
import type { RequestContext } from '@/libs/api/context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability, type PermissionKey } from '@/libs/api/permissions';

export const BROADCAST_ADDON = 'broadcast-messaging';

export type BroadcastGuard = { context: RequestContext; tenantId: string };

export async function broadcastGuard(request: Request, permission: PermissionKey): Promise<BroadcastGuard> {
  const context = await requireRequestContext(request);
  const tenantId = requireTenant(context);
  await requireAddon(tenantId, BROADCAST_ADDON);
  await requireCapability(context, permission);
  return { context, tenantId };
}
