import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability, type PermissionKey } from '@/libs/api/permissions';

export async function requireLibraryContext(request: Request, capability: PermissionKey) {
  const context = await requireRequestContext(request);
  const tenantId = requireTenant(context);
  await requireAddon(tenantId, 'library');
  await requireCapability(context, capability);
  return { context, tenantId };
}

export async function requireLibrarySelfContext(request: Request) {
  const context = await requireRequestContext(request, ['student', 'teacher', 'parent', 'alumni']);
  const tenantId = requireTenant(context);
  await requireAddon(tenantId, 'library');
  return { context, tenantId };
}
