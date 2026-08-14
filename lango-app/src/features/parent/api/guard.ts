// ---------------------------------------------------------------------------
// Parent Portal — route guard. Every /api/guardian/** route starts here.
// The effective role must be `parent` (validated by requireRequestContext); the
// tenant must exist. Per-request relationship authorization is applied by the
// feature-local resolver on top — never by a client-selected child id.
// ---------------------------------------------------------------------------

import type { RequestContext } from '@/libs/api/context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';

export async function requireParentContext(request: Request): Promise<RequestContext> {
  const ctx = await requireRequestContext(request, ['parent']);
  requireTenant(ctx);
  return ctx;
}
