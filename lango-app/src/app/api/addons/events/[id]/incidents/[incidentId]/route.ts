import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { updateEventIncident } from '@/features/events/services/event-operations-service';

const updateIncidentSchema = z.object({
  status: z.enum(['open', 'resolving', 'resolved', 'closed']).optional(),
  description: z.string().max(2000).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
}).strict();

type Params = { params: Promise<{ id: string; incidentId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, incidentId } = await params;
    const body = await parseJson(request, updateIncidentSchema);
    const incident = await updateEventIncident(tenantId, id, incidentId, context.userId, body);
    recordAudit(context, 'update', 'event_incident', incidentId, { eventId: id, status: body.status });
    return NextResponse.json({ success: true, data: incident });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
