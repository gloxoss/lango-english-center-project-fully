import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listAllocations } from '@/features/hostel/services/allocation-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.read');

    const url = new URL(request.url);
    const allocations = await listAllocations(tenantId, {
      hostelId: url.searchParams.get('hostelId'),
      state: url.searchParams.get('state'),
      asOf: url.searchParams.get('asOf'),
    });
    return NextResponse.json({ success: true, data: allocations });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
