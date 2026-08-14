import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getAllocation } from '@/features/hostel/services/allocation-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(_request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.read');

    const { id } = await params;
    const allocation = await getAllocation(tenantId, id);
    return NextResponse.json({ success: true, data: allocation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
