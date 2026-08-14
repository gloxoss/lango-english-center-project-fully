import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { listEventIncidents, reportEventIncident } from '@/features/events/services/event-operations-service';

const createIncidentSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  occurrenceId: z.uuid().nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const incidents = await listEventIncidents(tenantId, id);
    return NextResponse.json({ success: true, data: incidents });
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
    const body = await parseJson(request, createIncidentSchema);
    const incident = await reportEventIncident(tenantId, id, context.userId, body);
    recordAudit(context, 'create', 'event_incident', incident!.id, { eventId: id, severity: body.severity });
    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
