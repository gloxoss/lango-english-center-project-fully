import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { getGuardianProjection } from '@/features/hostel/services/projections-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    if (context.role !== 'parent') {
      throw new ApiError(403, 'FORBIDDEN', 'Réservé aux tuteurs.');
    }

    const data = await getGuardianProjection(tenantId, context.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
