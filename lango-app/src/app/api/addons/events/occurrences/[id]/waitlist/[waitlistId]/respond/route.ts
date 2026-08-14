import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { respondToWaitlistOffer } from '@/features/events/services/event-operations-service';

const respondSchema = z.object({
  action: z.enum(['accept', 'decline']),
}).strict();

type Params = { params: Promise<{ waitlistId: string }> };

// Self-service: the person may only respond to their own offer. The
// authenticated user IS the personId — no client-chosen identity is ever
// honored as authorization.
export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { waitlistId } = await params;
    const body = await parseJson(request, respondSchema);
    const result = await respondToWaitlistOffer(tenantId, waitlistId, context.userId, body.action);
    recordAudit(context, 'update', 'event_waitlist_entry', waitlistId, { action: body.action });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
