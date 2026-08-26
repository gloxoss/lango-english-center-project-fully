import { NextResponse } from 'next/server';
import { createPlatformPortalSession, requirePlatformBillingAdmin } from '@/features/subscriptions/services/platform-billing-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin'], { allowSuspended: true });
    const tenantId = requirePlatformBillingAdmin(context);
    const session = await createPlatformPortalSession(tenantId, new URL(request.url).origin);
    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
