// ---------------------------------------------------------------------------
// Teacher Portal — route guard. Every /api/teacher/me/** route starts here.
// The effective role must be `teacher` (validated by requireRequestContext);
// the tenant must exist. Every query is scoped by the session teacherId and
// tenantId — a client can never read another teacher's or tenant's data.
// ---------------------------------------------------------------------------

import type { RequestContext } from '@/libs/api/context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';

export async function requireTeacherContext(request: Request): Promise<RequestContext> {
  const ctx = await requireRequestContext(request, ['teacher']);
  requireTenant(ctx);
  return ctx;
}
