import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listAllocationEvents } from '@/features/hostel/services/allocation-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(_request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.read');

    const { id } = await params;
    const canReadSensitive = await hasCapability(
      context.userId, context.tenantId ?? '', context.role, 'hostel.safeguarding.read');
    const events = await listAllocationEvents(tenantId, id, canReadSensitive);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
