import type { NextRequest } from 'next/server';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const rsvpSchema = z.object({ status: z.enum(['going', 'not_going', 'maybe']) }).strict();

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const { id: eventId } = await params;
    const body = await parseJson(req, rsvpSchema);

    const result = await db.transaction(async (tx) => {
      // Advisory transaction lock per event to serialize capacity checks
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${eventId}`}, 0))`,
      );

      // Verify event exists and is published
      const [event] = await tx
        .select({
          id: alumniEvents.id,
          isPublished: alumniEvents.isPublished,
          isCancelled: alumniEvents.isCancelled,
          cancellationReason: alumniEvents.cancellationReason,
          capacity: alumniEvents.capacity,
          targetCohortSessionYearId: alumniEvents.targetCohortSessionYearId,
          targetBranchId: alumniEvents.targetBranchId,
        })
        .from(alumniEvents)
        .where(and(eq(alumniEvents.id, eventId), eq(alumniEvents.tenantId, tenantId)))
        .limit(1);

      if (!event || !event.isPublished) {
        throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
      }

      if (event.isCancelled) {
        throw new ApiError(422, 'EVENT_CANCELLED', `Cet événement a été annulé${event.cancellationReason ? ` : ${event.cancellationReason}` : ''}.`);
      }

      // Audience eligibility validation
      const [alumnus] = await tx
        .select({
          branchId: user.branchId,
          cohortId: user.graduationCohortSessionYearId,
        })
        .from(user)
        .where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId)))
        .limit(1);

      if (event.targetCohortSessionYearId && alumnus?.cohortId !== event.targetCohortSessionYearId) {
        throw new ApiError(403, 'NOT_ELIGIBLE', 'Cet événement est réservé à une promotion spécifique.');
      }

      if (event.targetBranchId && alumnus?.branchId !== event.targetBranchId) {
        throw new ApiError(403, 'NOT_ELIGIBLE', 'Cet événement est réservé à une annexe spécifique.');
      }

      // Check existing RSVP state
      const [existingRsvp] = await tx
        .select({
          id: alumniEventRsvps.id,
          status: alumniEventRsvps.status,
          isWaitlisted: alumniEventRsvps.isWaitlisted,
          waitlistPosition: alumniEventRsvps.waitlistPosition,
        })
        .from(alumniEventRsvps)
        .where(
          and(
            eq(alumniEventRsvps.tenantId, tenantId),
            eq(alumniEventRsvps.eventId, eventId),
            eq(alumniEventRsvps.alumnusId, context.userId),
          ),
        )
        .limit(1);

      const nowIso = new Date().toISOString();
      let newIsWaitlisted = false;
      let newWaitlistPosition: number | null = null;
      let message = 'RSVP enregistré avec succès';

      if (body.status === 'going') {
        if (existingRsvp?.status === 'going') {
          // Already registered as going; maintain current placement
          newIsWaitlisted = existingRsvp.isWaitlisted;
          newWaitlistPosition = existingRsvp.waitlistPosition;
        } else if (event.capacity != null) {
          // Count currently confirmed attendees
          const [confirmedCountRow] = await tx
            .select({ count: count() })
            .from(alumniEventRsvps)
            .where(
              and(
                eq(alumniEventRsvps.tenantId, tenantId),
                eq(alumniEventRsvps.eventId, eventId),
                eq(alumniEventRsvps.status, 'going'),
                eq(alumniEventRsvps.isWaitlisted, false),
              ),
            );

          const currentConfirmed = Number(confirmedCountRow?.count ?? 0);

          if (currentConfirmed >= event.capacity) {
            // Capacity reached: place on waitlist
            const [waitlistCountRow] = await tx
              .select({ count: count() })
              .from(alumniEventRsvps)
              .where(
                and(
                  eq(alumniEventRsvps.tenantId, tenantId),
                  eq(alumniEventRsvps.eventId, eventId),
                  eq(alumniEventRsvps.status, 'going'),
                  eq(alumniEventRsvps.isWaitlisted, true),
                ),
              );

            const currentWaitlist = Number(waitlistCountRow?.count ?? 0);
            newIsWaitlisted = true;
            newWaitlistPosition = currentWaitlist + 1;
            message = `Événement complet. Vous êtes sur liste d'attente (position #${newWaitlistPosition}).`;
          } else {
            newIsWaitlisted = false;
            newWaitlistPosition = null;
            message = 'Votre participation est confirmée !';
          }
        } else {
          newIsWaitlisted = false;
          newWaitlistPosition = null;
          message = 'Votre participation est confirmée !';
        }
      } else {
        // Status changed to not_going or maybe
        newIsWaitlisted = false;
        newWaitlistPosition = null;

        // If previously confirmed, promote the next waitlisted alumnus and shift remaining waitlist
        if (existingRsvp?.status === 'going' && !existingRsvp.isWaitlisted) {
          const [nextCandidate] = await tx
            .select({ id: alumniEventRsvps.id })
            .from(alumniEventRsvps)
            .where(
              and(
                eq(alumniEventRsvps.tenantId, tenantId),
                eq(alumniEventRsvps.eventId, eventId),
                eq(alumniEventRsvps.status, 'going'),
                eq(alumniEventRsvps.isWaitlisted, true),
              ),
            )
            .orderBy(asc(alumniEventRsvps.waitlistPosition), asc(alumniEventRsvps.createdAt))
            .limit(1);

          if (nextCandidate) {
            await tx
              .update(alumniEventRsvps)
              .set({
                isWaitlisted: false,
                waitlistPosition: null,
                updatedAt: nowIso,
              })
              .where(eq(alumniEventRsvps.id, nextCandidate.id));

            // Shift down all remaining waitlisted attendees
            await tx
              .update(alumniEventRsvps)
              .set({
                waitlistPosition: sql`GREATEST(1, ${alumniEventRsvps.waitlistPosition} - 1)`,
                updatedAt: nowIso,
              })
              .where(
                and(
                  eq(alumniEventRsvps.tenantId, tenantId),
                  eq(alumniEventRsvps.eventId, eventId),
                  eq(alumniEventRsvps.status, 'going'),
                  eq(alumniEventRsvps.isWaitlisted, true),
                ),
              );
          }
        } else if (existingRsvp?.status === 'going' && existingRsvp.isWaitlisted && existingRsvp.waitlistPosition != null) {
          // If previously on waitlist, re-index everyone behind them
          const cancelledPos = existingRsvp.waitlistPosition;
          await tx
            .update(alumniEventRsvps)
            .set({
              waitlistPosition: sql`GREATEST(1, ${alumniEventRsvps.waitlistPosition} - 1)`,
              updatedAt: nowIso,
            })
            .where(
              and(
                eq(alumniEventRsvps.tenantId, tenantId),
                eq(alumniEventRsvps.eventId, eventId),
                eq(alumniEventRsvps.status, 'going'),
                eq(alumniEventRsvps.isWaitlisted, true),
                sql`${alumniEventRsvps.waitlistPosition} > ${cancelledPos}`,
              ),
            );
        }
      }

      // Upsert RSVP
      const [savedRsvp] = await tx
        .insert(alumniEventRsvps)
        .values({
          tenantId,
          eventId,
          alumnusId: context.userId,
          status: body.status,
          isWaitlisted: newIsWaitlisted,
          waitlistPosition: newWaitlistPosition,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: [alumniEventRsvps.eventId, alumniEventRsvps.alumnusId],
          set: {
            status: body.status,
            isWaitlisted: newIsWaitlisted,
            waitlistPosition: newWaitlistPosition,
            updatedAt: nowIso,
          },
        })
        .returning();

      return { rsvp: savedRsvp, message };
    });

    return NextResponse.json({
      success: true,
      data: result.rsvp,
      message: result.message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
