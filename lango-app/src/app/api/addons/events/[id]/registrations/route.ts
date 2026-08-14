import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { registerForEvent } from '@/features/events/services/events-service';
import { listEventRegistrations } from '@/features/events/services/event-operations-service';

const registerSchema = z.object({
  occurrenceId: z.uuid(),
  seats: z.number().int().min(1).max(10).optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

// Attendee list carries registration answers/consent - staff-only
// (events.registration.manage), distinct from events.read used to self-RSVP.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.registration.manage');

    const { id } = await params;
    const registrations = await listEventRegistrations(tenantId, id);
    return NextResponse.json({ success: true, data: registrations });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const body = await parseJson(request, registerSchema);
    const result = await registerForEvent(tenantId, body.occurrenceId, context.userId, body.seats ?? 1);
    recordAudit(context, 'create', 'event_registration', id, { occurrenceId: body.occurrenceId, status: result.status });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
