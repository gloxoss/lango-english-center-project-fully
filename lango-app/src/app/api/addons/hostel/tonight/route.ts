import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getTonight } from '@/features/hostel/services/tonight-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.read');

    const { searchParams } = new URL(request.url);
    const hostelId = searchParams.get('hostelId');
    if (!hostelId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Le paramètre hostelId est requis.');
    }
    const data = await getTonight(tenantId, {
      hostelId,
      callDate: searchParams.get('callDate'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
