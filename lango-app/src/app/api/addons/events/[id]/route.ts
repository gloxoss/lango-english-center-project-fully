import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { getEventDetail, updateEvent } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string }> };

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  visibility: z.enum(['public', 'internal', 'targeted']).optional(),
  timezone: z.string().max(64).optional(),
  typeId: z.string().max(64).nullable().optional(),
}).strict();

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

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const body = await parseJson(request, updateEventSchema);
    const event = await updateEvent(tenantId, id, context.userId, body);
    recordAudit(context, 'update', 'event', id, { fields: Object.keys(body) });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
