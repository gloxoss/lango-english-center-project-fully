import { NextResponse } from 'next/server';
import { createPlatformCheckoutSession, requirePlatformBillingAdmin } from '@/features/subscriptions/services/platform-billing-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin'], { allowSuspended: true });
    const tenantId = requirePlatformBillingAdmin(context);
    const session = await createPlatformCheckoutSession(tenantId, new URL(request.url).origin);
    return NextResponse.json({ success: true, data: { id: session.id, url: session.url } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
