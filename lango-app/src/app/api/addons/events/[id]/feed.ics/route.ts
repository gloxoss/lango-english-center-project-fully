import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { assertFamilyEventReadable, buildEventIcs } from '@/features/events/services/event-operations-service';
import { isFamilyEventViewerRole, resolveEventViewerContext } from '@/features/events/services/audience-service';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const { id } = await params;
    if (isFamilyEventViewerRole(context.role)) {
      await assertFamilyEventReadable(tenantId, id, await resolveEventViewerContext(context.userId, context.role));
    }
    const ics = await buildEventIcs(tenantId, id);
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${id}.ics"`,
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error);
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
