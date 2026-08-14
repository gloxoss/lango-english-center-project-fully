import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { deleteEventVenue, updateEventVenue } from '@/features/events/services/event-operations-service';

const updateVenueSchema = z.object({
  venueType: z.enum(['physical', 'online', 'hybrid']).optional(),
  name: z.string().max(255).optional(),
  address: z.string().max(500).optional(),
  capacity: z.number().int().positive().optional(),
  onlineLink: z.string().max(1000).optional(),
  accessibilityNotes: z.string().max(1000).optional(),
}).strict();

type Params = { params: Promise<{ id: string; venueId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, venueId } = await params;
    const body = await parseJson(request, updateVenueSchema);
    const venue = await updateEventVenue(tenantId, id, venueId, body);
    recordAudit(context, 'update', 'event_venue', venueId, { eventId: id });
    return NextResponse.json({ success: true, data: venue });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, venueId } = await params;
    await deleteEventVenue(tenantId, id, venueId);
    recordAudit(context, 'delete', 'event_venue', venueId, { eventId: id });
    return NextResponse.json({ success: true, data: { id: venueId } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
