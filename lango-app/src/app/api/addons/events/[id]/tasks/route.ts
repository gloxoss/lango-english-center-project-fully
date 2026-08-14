import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { createEventTask, listEventTasks } from '@/features/events/services/event-operations-service';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  occurrenceId: z.uuid().nullable().optional(),
  dueAt: z.string().max(40).nullable().optional(),
  assigneeId: z.string().max(64).nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const tasks = await listEventTasks(tenantId, id);
    return NextResponse.json({ success: true, data: tasks });
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
    const body = await parseJson(request, createTaskSchema);
    const task = await createEventTask(tenantId, id, context.userId, body);
    recordAudit(context, 'create', 'event_task', task!.id, { eventId: id });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
