import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { createEvent, listVisibleEvents } from '@/features/events/services/events-service';

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional(),
  typeId: z.string().max(64).optional(),
  visibility: z.enum(['public', 'internal', 'targeted']).optional(),
  timezone: z.string().max(64).optional(),
  lifecycle: z.enum(['draft', 'published']).optional(),
  schedules: z.array(z.object({
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    isAllDay: z.boolean().optional(),
    timezone: z.string().max(64).optional(),
    recurrenceRule: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
    recurrenceEndDate: z.string().max(40).nullable().optional(),
  })).min(1),
  venues: z.array(z.object({
    venueType: z.enum(['physical', 'online', 'hybrid']).optional(),
    name: z.string().max(255).optional(),
    address: z.string().max(500).optional(),
    capacity: z.number().int().positive().optional(),
    onlineLink: z.string().max(1000).optional(),
  })).optional(),
  audienceRules: z.array(z.object({
    targetKind: z.enum(['school', 'role', 'class_offering', 'class_section', 'class_subject', 'user', 'group']),
    targetRoleValue: z.string().max(255).nullable().optional(),
    targetRefId: z.string().max(255).nullable().optional(),
  })).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const events = await listVisibleEvents(tenantId, context.userId, context.role);

    return NextResponse.json({ success: true, data: events });
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

    const body = await parseJson(request, createEventSchema);
    const event = await createEvent({
      tenantId,
      ownerId: context.userId,
      branchId: context.branchId ?? undefined,
      typeId: body.typeId,
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      timezone: body.timezone,
      lifecycle: body.lifecycle,
      schedules: body.schedules,
      venues: body.venues,
      audienceRules: body.audienceRules,
    });
    recordAudit(context, 'create', 'event', event!.id, { title: body.title });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
