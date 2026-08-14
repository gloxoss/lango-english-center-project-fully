import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getEventDetail } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    const detail = await getEventDetail(tenantId, id);
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
