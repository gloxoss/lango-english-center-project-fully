import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalMe } from '@/features/portal/services/portal-me';

// GET /api/portal/me — server-derived actor/tenant/active-role context.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    // tenantId, role and baseRole are server-derived inside
    // requireRequestContext (session-bound); getPortalMe scopes every
    // permission/preference read by ctx.tenantId. The client never supplies
    // any of these values.
    const data = await getPortalMe(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
