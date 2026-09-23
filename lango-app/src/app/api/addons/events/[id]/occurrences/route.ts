import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { events, eventOccurrences } from '@/features/events/models/events-schema';
import { isFamilyEventViewerRole, resolveEventViewerContext } from '@/features/events/services/audience-service';
import { assertFamilyEventReadable } from '@/features/events/services/event-operations-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    if (isFamilyEventViewerRole(context.role)) {
      await assertFamilyEventReadable(tenantId, id, await resolveEventViewerContext(context.userId, context.role));
    } else {
      const [event] = await db.select({ id: events.id }).from(events)
        .where(and(eq(events.id, id), eq(events.tenantId, tenantId))).limit(1);
      if (!event) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Événement introuvable.' } }, { status: 404 });
    }

    const occurrences = await db
      .select()
      .from(eventOccurrences)
      .where(and(eq(eventOccurrences.eventId, id), eq(eventOccurrences.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: occurrences });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
