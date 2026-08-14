import { and, asc, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents } from '@/models/Schema';

// Real, tenant-scoped upcoming events with the current alumnus's own real
// RSVP status annotated (future-implementation/alumni-portal).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    const events = await db
      .select()
      .from(alumniEvents)
      .where(and(eq(alumniEvents.tenantId, tenantId), gte(alumniEvents.startsAt, new Date().toISOString())))
      .orderBy(asc(alumniEvents.startsAt));

    const rsvps = await db
      .select({ eventId: alumniEventRsvps.eventId, status: alumniEventRsvps.status })
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.tenantId, tenantId), eq(alumniEventRsvps.alumnusId, context.userId)));
    const rsvpByEvent = new Map(rsvps.map(r => [r.eventId, r.status]));

    return NextResponse.json({
      success: true,
      data: events.map(e => ({ ...e, myRsvpStatus: rsvpByEvent.get(e.id) ?? null })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
