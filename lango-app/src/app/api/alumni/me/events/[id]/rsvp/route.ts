import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const rsvpSchema = z.object({ status: z.enum(['going', 'not_going', 'maybe']) }).strict();

// Real, idempotent RSVP upsert on the real unique (event, alumnus) pair
// (future-implementation/alumni-portal).
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const { id: eventId } = await params;
    const body = await parseJson(req, rsvpSchema);

    const [event] = await db.select({ id: alumniEvents.id }).from(alumniEvents).where(and(eq(alumniEvents.id, eventId), eq(alumniEvents.tenantId, tenantId))).limit(1);
    if (!event) {
      throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    }

    const [rsvp] = await db
      .insert(alumniEventRsvps)
      .values({ tenantId, eventId, alumnusId: context.userId, status: body.status })
      .onConflictDoUpdate({
        target: [alumniEventRsvps.eventId, alumniEventRsvps.alumnusId],
        set: { status: body.status, updatedAt: new Date().toISOString() },
      })
      .returning();

    return NextResponse.json({ success: true, data: rsvp, message: 'RSVP enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
