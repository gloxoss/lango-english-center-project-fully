import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { getResidentProjection } from '@/features/hostel/services/projections-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    if (context.role !== 'student') {
      throw new ApiError(403, 'FORBIDDEN', 'Réservé aux élèves.');
    }

    const data = await getResidentProjection(tenantId, context.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
