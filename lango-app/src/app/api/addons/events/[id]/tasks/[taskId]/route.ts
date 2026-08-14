import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { updateEventTask } from '@/features/events/services/event-operations-service';

const updateTaskSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueAt: z.string().max(40).nullable().optional(),
  assigneeId: z.string().max(64).nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, taskId } = await params;
    const body = await parseJson(request, updateTaskSchema);
    const task = await updateEventTask(tenantId, id, taskId, body);
    recordAudit(context, 'update', 'event_task', taskId, { eventId: id, status: body.status });
    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
