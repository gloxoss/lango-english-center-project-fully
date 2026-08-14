import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { createEventType, listEventTypes } from '@/features/events/services/event-operations-service';

const createTypeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  style: z.record(z.string(), z.unknown()).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  requiresRsvp: z.boolean().optional(),
  requiresCheckin: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const types = await listEventTypes(tenantId);
    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.create');

    const body = await parseJson(request, createTypeSchema);
    const type = await createEventType(tenantId, body);
    recordAudit(context, 'create', 'event_type', type!.id, { name: body.name });
    return NextResponse.json({ success: true, data: type }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
