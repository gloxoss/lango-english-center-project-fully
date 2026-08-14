import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { listEventFeedback, submitEventFeedback } from '@/features/events/services/event-operations-service';

const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  occurrenceId: z.uuid().nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

// Staff review raw feedback (including hidden/pending entries) via
// events.report.read; self-submission only requires events.read.
export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.report.read');

    const { id } = await params;
    const feedback = await listEventFeedback(tenantId, id);
    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    const body = await parseJson(request, submitFeedbackSchema);
    const feedback = await submitEventFeedback(tenantId, id, context.userId, body);
    recordAudit(context, 'create', 'event_feedback', feedback!.id, { eventId: id });
    return NextResponse.json({ success: true, data: feedback }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
