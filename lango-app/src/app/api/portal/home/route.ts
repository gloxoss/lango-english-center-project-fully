import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalHome } from '@/features/portal/services/portal-home';

// GET /api/portal/home — role-scoped widgets + real tenant-scoped aggregates.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    if (context.role !== 'super_admin') {
      requireTenant(context);
    }
    const data = await getPortalHome(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
