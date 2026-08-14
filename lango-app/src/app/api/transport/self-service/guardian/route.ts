import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['parent', 'school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');

    // Self-service is strictly identity/relationship gated
    const guardianData = await TransportService.getGuardianTransportView(tenantId, context.userId);
    return NextResponse.json({ success: true, data: guardianData });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
