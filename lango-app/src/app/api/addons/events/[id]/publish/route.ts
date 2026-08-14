import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { publishEvent } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.publish');

    const { id } = await params;
    const event = await publishEvent(tenantId, id, context.userId);
    recordAudit(context, 'update', 'event', id, { lifecycle: 'published' });
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
