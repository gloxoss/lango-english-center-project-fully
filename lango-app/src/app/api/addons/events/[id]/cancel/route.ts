import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { cancelEvent } from '@/features/events/services/event-operations-service';

const cancelSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.publish');

    const { id } = await params;
    const body = await parseJson(request, cancelSchema);
    const event = await cancelEvent(tenantId, id, context.userId, body.reason ?? null);
    recordAudit(context, 'update', 'event', id, { lifecycle: 'cancelled', reason: body.reason ?? null });
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
