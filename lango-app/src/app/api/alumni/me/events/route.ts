import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents, branches, sessionYears, user } from '@/models/Schema';

// Real, tenant-scoped upcoming & published events for the current alumnus with audience eligibility,
// capacity, waitlist metrics, and their own RSVP status (future-implementation/alumni-portal).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    // Fetch current alumnus's graduation cohort and branch for audience rules
    const [me] = await db
      .select({
        branchId: user.branchId,
        cohortId: user.graduationCohortSessionYearId,
      })
      .from(user)
      .where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    const cohortCondition = me?.cohortId
      ? or(isNull(alumniEvents.targetCohortSessionYearId), eq(alumniEvents.targetCohortSessionYearId, me.cohortId))
      : isNull(alumniEvents.targetCohortSessionYearId);

    const branchCondition = me?.branchId
      ? or(isNull(alumniEvents.targetBranchId), eq(alumniEvents.targetBranchId, me.branchId))
      : isNull(alumniEvents.targetBranchId);

    // Only published events matching tenant and audience eligibility
    const events = await db
      .select({
        id: alumniEvents.id,
        title: alumniEvents.title,
        description: alumniEvents.description,
        location: alumniEvents.location,
        startsAt: alumniEvents.startsAt,
        endsAt: alumniEvents.endsAt,
        capacity: alumniEvents.capacity,
        targetCohortSessionYearId: alumniEvents.targetCohortSessionYearId,
        targetCohortName: sessionYears.name,
        targetBranchId: alumniEvents.targetBranchId,
        targetBranchName: branches.name,
        attachmentUrl: alumniEvents.attachmentUrl,
        isCancelled: alumniEvents.isCancelled,
        cancellationReason: alumniEvents.cancellationReason,
        createdAt: alumniEvents.createdAt,
      })
      .from(alumniEvents)
      .leftJoin(sessionYears, eq(alumniEvents.targetCohortSessionYearId, sessionYears.id))
      .leftJoin(branches, eq(alumniEvents.targetBranchId, branches.id))
      .where(
        and(
          eq(alumniEvents.tenantId, tenantId),
          eq(alumniEvents.isPublished, true),
          cohortCondition,
          branchCondition,
        ),
      )
      .orderBy(desc(alumniEvents.startsAt));

    const eventIds = events.map(e => e.id);

    // Current alumnus's RSVP records
    const myRsvps = eventIds.length > 0
      ? await db
          .select({
            eventId: alumniEventRsvps.eventId,
            status: alumniEventRsvps.status,
            isWaitlisted: alumniEventRsvps.isWaitlisted,
            waitlistPosition: alumniEventRsvps.waitlistPosition,
            checkedIn: alumniEventRsvps.checkedIn,
          })
          .from(alumniEventRsvps)
          .where(
            and(
              eq(alumniEventRsvps.tenantId, tenantId),
              eq(alumniEventRsvps.alumnusId, context.userId),
              inArray(alumniEventRsvps.eventId, eventIds),
            ),
          )
      : [];

    const myRsvpMap = new Map(myRsvps.map(r => [r.eventId, r]));

    // Total confirmed and waitlist counts per event
    const counts = eventIds.length > 0
      ? await db
          .select({
            eventId: alumniEventRsvps.eventId,
            isWaitlisted: alumniEventRsvps.isWaitlisted,
            status: alumniEventRsvps.status,
            count: count(),
          })
          .from(alumniEventRsvps)
          .where(and(eq(alumniEventRsvps.tenantId, tenantId), inArray(alumniEventRsvps.eventId, eventIds)))
          .groupBy(alumniEventRsvps.eventId, alumniEventRsvps.status, alumniEventRsvps.isWaitlisted)
      : [];

    const confirmedCountMap = new Map<string, number>();
    const waitlistCountMap = new Map<string, number>();

    for (const c of counts) {
      if (c.status === 'going') {
        if (c.isWaitlisted) {
          waitlistCountMap.set(c.eventId, (waitlistCountMap.get(c.eventId) ?? 0) + Number(c.count));
        } else {
          confirmedCountMap.set(c.eventId, (confirmedCountMap.get(c.eventId) ?? 0) + Number(c.count));
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: events.map((e) => {
        const myRsvp = myRsvpMap.get(e.id);
        const confirmedCount = confirmedCountMap.get(e.id) ?? 0;
        const waitlistCount = waitlistCountMap.get(e.id) ?? 0;
        const isFull = e.capacity != null && confirmedCount >= e.capacity;

        return {
          ...e,
          myRsvpStatus: myRsvp?.status ?? null,
          myIsWaitlisted: myRsvp?.isWaitlisted ?? false,
          myWaitlistPosition: myRsvp?.waitlistPosition ?? null,
          myCheckedIn: myRsvp?.checkedIn ?? false,
          totalConfirmed: confirmedCount,
          totalWaitlist: waitlistCount,
          isFull,
        };
      }),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
