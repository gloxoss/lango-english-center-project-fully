// ---------------------------------------------------------------------------
// Student Portal — route guard. Every /api/student/me/** route starts here.
// The effective role must be `student` (validated by requireRequestContext);
// the tenant must exist. Every query is scoped by the session studentId and
// tenantId — a client can never read another student's or tenant's data.
// ---------------------------------------------------------------------------

import type { RequestContext } from '@/libs/api/context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';

export async function requireStudentContext(request: Request): Promise<RequestContext> {
  const ctx = await requireRequestContext(request, ['student']);
  requireTenant(ctx);
  return ctx;
}
