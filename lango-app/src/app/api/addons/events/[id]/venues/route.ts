import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { addEventVenue, listEventVenues } from '@/features/events/services/event-operations-service';

const createVenueSchema = z.object({
  venueType: z.enum(['physical', 'online', 'hybrid']).optional(),
  name: z.string().max(255).optional(),
  address: z.string().max(500).optional(),
  capacity: z.number().int().positive().optional(),
  onlineLink: z.string().max(1000).optional(),
  accessibilityNotes: z.string().max(1000).optional(),
  occurrenceId: z.uuid().nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    const venues = await listEventVenues(tenantId, id);
    return NextResponse.json({ success: true, data: venues });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const body = await parseJson(request, createVenueSchema);
    const venue = await addEventVenue(tenantId, id, body);
    recordAudit(context, 'create', 'event_venue', venue!.id, { eventId: id });
    return NextResponse.json({ success: true, data: venue }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
