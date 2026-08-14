import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { moderateEventFeedback } from '@/features/events/services/event-operations-service';

const moderateSchema = z.object({
  status: z.enum(['pending', 'published', 'hidden']),
}).strict();

type Params = { params: Promise<{ id: string; feedbackId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, feedbackId } = await params;
    const body = await parseJson(request, moderateSchema);
    const feedback = await moderateEventFeedback(tenantId, id, feedbackId, body.status);
    recordAudit(context, 'update', 'event_feedback', feedbackId, { eventId: id, status: body.status });
    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
