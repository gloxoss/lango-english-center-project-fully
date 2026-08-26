import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { getSubscriptionDetail } from '@/features/subscriptions/services/subscription-service';

// GET /api/settings/subscription - this school's license, payment history and
// addon grants. Read-only: license and addon changes are super-admin decisions
// (SUBSCRIPTION-AND-LICENSING-SYSTEM.md page 1).
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin'], { allowSuspended: true });
    await requireCapability(ctx, 'settings.read');
    const tenantId = requireTenant(ctx);

    const data = await getSubscriptionDetail(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
