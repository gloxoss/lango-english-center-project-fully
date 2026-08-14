import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalActivity } from '@/features/portal/services/portal-activity';

// GET /api/portal/activity?limit= — the actor's own portal activity trail.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 20;

    const events = await getPortalActivity(tenantId, context.userId, limit);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
