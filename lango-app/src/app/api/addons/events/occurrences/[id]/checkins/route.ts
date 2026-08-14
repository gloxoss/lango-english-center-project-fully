import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { checkinOccurrence, listOccurrenceCheckins } from '@/features/events/services/event-operations-service';

const checkinSchema = z.object({
  personId: z.string().min(1).max(255),
  method: z.enum(['qr', 'manual_search', 'self_service']).optional(),
  registrationId: z.string().max(64).nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    const checkins = await listOccurrenceCheckins(tenantId, id);
    return NextResponse.json({ success: true, data: checkins });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.checkin');

    const { id } = await params;
    const body = await parseJson(request, checkinSchema);
    const result = await checkinOccurrence({
      tenantId,
      occurrenceId: id,
      personId: body.personId,
      operatorId: context.userId,
      method: body.method,
      registrationId: body.registrationId,
    });
    if (!result.duplicated) {
      recordAudit(context, 'create', 'event_checkin', result.checkin!.id, { occurrenceId: id, personId: body.personId });
    }
    return NextResponse.json({ success: true, data: result }, { status: result.duplicated ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
