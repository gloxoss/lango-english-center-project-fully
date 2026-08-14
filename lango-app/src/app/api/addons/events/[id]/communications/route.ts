import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { listEventCommunications, sendEventCommunication } from '@/features/events/services/event-operations-service';

const sendCommunicationSchema = z.object({
  kind: z.enum(['reminder', 'invitation', 'announcement', 'cancellation', 'feedback_request']),
  message: z.string().trim().min(1).max(2000),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.communication.send');

    const { id } = await params;
    const jobs = await listEventCommunications(tenantId, id);
    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// Targets the event's confirmed registrants (see event-operations-service.ts
// sendEventCommunication doc comment for the deliberate scope boundary) and
// delivers via the existing in-app notification outbox - synchronous, no new
// queue/worker.
export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.communication.send');

    const { id } = await params;
    const body = await parseJson(request, sendCommunicationSchema);
    const job = await sendEventCommunication(tenantId, id, body);
    recordAudit(context, 'create', 'event_communication_job', job!.id, { eventId: id, kind: body.kind });
    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
