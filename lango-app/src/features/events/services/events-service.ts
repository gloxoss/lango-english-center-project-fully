import { db } from '@/libs/DB';
import { eq, and, sql, inArray, asc, desc } from 'drizzle-orm';
import {
  events, eventSchedules, eventOccurrences, eventVenues,
  eventAudienceRules, eventRegistrations, eventWaitlistEntries
} from '@/features/events/models/events-schema';
import { ApiError } from '@/libs/api/errors';
import { isEventVisibleToUser, resolveEventViewerContext, type EventTargetRow } from './audience-service';
import { buildOccurrenceRows } from './event-operations-service';
import type { AppRole } from '@/libs/api/context';

export type CreateEventInput = {
  tenantId: string;
  ownerId: string;
  branchId?: string;
  typeId?: string;
  title: string;
  description?: string;
  visibility?: 'public' | 'internal' | 'targeted';
  timezone?: string;
  lifecycle?: 'draft' | 'published';
  schedules: {
    startTime: string;
    endTime: string;
    isAllDay?: boolean;
    timezone?: string;
    recurrenceRule?: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrenceEndDate?: string | null;
  }[];
  venues?: {
    venueType?: 'physical' | 'online' | 'hybrid';
    name?: string;
    address?: string;
    capacity?: number;
    onlineLink?: string;
  }[];
  audienceRules?: {
    targetKind: EventTargetRow['targetKind'];
    targetRoleValue?: string | null;
    targetRefId?: string | null;
  }[];
};

export type VisibleEvent = {
  id: string;
  title: string;
  eventType: string;
  description: string | null;
  visibility: string;
  timezone: string;
  schedules: {
    id: string;
    isAllDay: boolean;
    timezone: string;
    occurrences: {
      id: string;
      startTime: string;
      endTime: string;
      originalDate: string;
      isCancelled: boolean;
    }[];
  }[];
  venues: {
    id: string;
    name: string | null;
    venueType: string;
    address: string | null;
  }[];
  audienceRules: EventTargetRow[];
  registeredSeats: number;
  totalCapacity: number;
};

export async function createEvent(input: CreateEventInput) {
  return await db.transaction(async (tx) => {
    // 1. Create Event
    const [event] = await tx.insert(events).values({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      branchId: input.branchId,
      typeId: input.typeId,
      title: input.title,
      description: input.description,
      visibility: input.visibility || 'internal',
      timezone: input.timezone || 'UTC',
      lifecycle: input.lifecycle ?? 'draft',
    }).returning();

    if (!event) {
      throw new ApiError(500, 'EVENT_CREATE_FAILED', 'Impossible de créer l\'événement.');
    }

    // 2. Create Schedule & occurrences (bounded recurrence expansion)
    for (const sched of input.schedules) {
      const [schedule] = await tx.insert(eventSchedules).values({
        tenantId: input.tenantId,
        eventId: event.id,
        startTime: sched.startTime,
        endTime: sched.endTime,
        isAllDay: sched.isAllDay || false,
        timezone: sched.timezone || 'UTC',
        recurrenceRule: sched.recurrenceRule ?? 'none',
        recurrenceEndDate: sched.recurrenceEndDate,
      }).returning();

      if (!schedule) {
        throw new ApiError(500, 'EVENT_SCHEDULE_CREATE_FAILED', 'Impossible de créer la session.');
      }

      await tx.insert(eventOccurrences).values(
        buildOccurrenceRows(input.tenantId, event.id, schedule),
      );
    }

    // 3. Create Venue
    if (input.venues && input.venues.length > 0) {
      for (const venue of input.venues) {
        await tx.insert(eventVenues).values({
          tenantId: input.tenantId,
          eventId: event.id,
          venueType: venue.venueType || 'physical',
          name: venue.name,
          address: venue.address,
          capacity: venue.capacity,
          onlineLink: venue.onlineLink,
        });
      }
    }

    // 4. Create Audience Rules
    if (input.visibility === 'targeted' && input.audienceRules && input.audienceRules.length > 0) {
      for (const rule of input.audienceRules) {
        await tx.insert(eventAudienceRules).values({
          tenantId: input.tenantId,
          eventId: event.id,
          targetKind: rule.targetKind,
          targetRoleValue: rule.targetRoleValue,
          targetRefId: rule.targetRefId,
        });
      }
    }

    return event;
  });
}

export async function listVisibleEvents(
  tenantId: string,
  userId: string,
  role: AppRole,
  opts?: { publishedOnly?: boolean },
): Promise<VisibleEvent[]> {
  const viewer = await resolveEventViewerContext(userId, role);

  let eventRows = await db.select().from(events).where(eq(events.tenantId, tenantId));
  if (opts?.publishedOnly) {
    eventRows = eventRows.filter(r => r.lifecycle === 'published');
  }
  if (eventRows.length === 0) return [];

  const eventIds = eventRows.map(r => r.id);
  const [schedules, venues, audienceRules] = await Promise.all([
    db.select().from(eventSchedules).where(inArray(eventSchedules.eventId, eventIds)),
    db.select().from(eventVenues).where(inArray(eventVenues.eventId, eventIds)),
    db.select().from(eventAudienceRules).where(inArray(eventAudienceRules.eventId, eventIds)),
  ]);

  const scheduleIds = schedules.map(s => s.id);
  const occurrences = scheduleIds.length > 0
    ? await db.select().from(eventOccurrences).where(inArray(eventOccurrences.scheduleId, scheduleIds))
    : [];

  // Per-event registration seats and capacity, so the UI shows real numbers.
  const regCountRows = eventIds.length > 0
    ? await db
        .select({ eventId: eventOccurrences.eventId, totalSeats: sql<number>`COALESCE(SUM(${eventRegistrations.seats}), 0)` })
        .from(eventRegistrations)
        .innerJoin(eventOccurrences, eq(eventRegistrations.occurrenceId, eventOccurrences.id))
        .where(and(eq(eventRegistrations.status, 'going'), inArray(eventOccurrences.eventId, eventIds)))
        .groupBy(eventOccurrences.eventId)
    : [];
  const capCountRows = eventIds.length > 0
    ? await db
        .select({ eventId: eventVenues.eventId, totalCapacity: sql<number>`COALESCE(SUM(${eventVenues.capacity}), 0)` })
        .from(eventVenues)
        .where(inArray(eventVenues.eventId, eventIds))
        .groupBy(eventVenues.eventId)
    : [];
  const regByEvent = new Map(regCountRows.map(r => [r.eventId, Number(r.totalSeats) || 0]));
  const capByEvent = new Map(capCountRows.map(r => [r.eventId, Number(r.totalCapacity) || 0]));

  const schedulesByEvent = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const list = schedulesByEvent.get(s.eventId) ?? [];
    list.push(s);
    schedulesByEvent.set(s.eventId, list);
  }
  const venuesByEvent = new Map<string, typeof venues>();
  for (const v of venues) {
    const list = venuesByEvent.get(v.eventId) ?? [];
    list.push(v);
    venuesByEvent.set(v.eventId, list);
  }
  const rulesByEvent = new Map<string, typeof audienceRules>();
  for (const r of audienceRules) {
    const list = rulesByEvent.get(r.eventId) ?? [];
    list.push(r);
    rulesByEvent.set(r.eventId, list);
  }
  const occurrencesBySchedule = new Map<string, typeof occurrences>();
  for (const o of occurrences) {
    const list = occurrencesBySchedule.get(o.scheduleId) ?? [];
    list.push(o);
    occurrencesBySchedule.set(o.scheduleId, list);
  }

  return eventRows.flatMap(event => {
    const targets = (rulesByEvent.get(event.id) ?? []).map(r => ({
      targetKind: r.targetKind,
      targetRoleValue: r.targetRoleValue,
      targetRefId: r.targetRefId,
    })) as EventTargetRow[];

    if (event.visibility === 'targeted' && !isEventVisibleToUser(targets, viewer)) {
      return [];
    }

    return [{
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      description: event.description,
      visibility: event.visibility,
      timezone: event.timezone,
      schedules: (schedulesByEvent.get(event.id) ?? []).map(s => ({
        id: s.id,
        isAllDay: s.isAllDay,
        timezone: s.timezone,
        occurrences: (occurrencesBySchedule.get(s.id) ?? []).map(o => ({
          id: o.id,
          startTime: o.startTime,
          endTime: o.endTime,
          originalDate: o.originalDate,
          isCancelled: o.isCancelled,
        })),
      })),
      venues: (venuesByEvent.get(event.id) ?? []).map(v => ({
        id: v.id,
        name: v.name,
        venueType: v.venueType,
        address: v.address,
      })),
      audienceRules: targets,
      registeredSeats: regByEvent.get(event.id) ?? 0,
      totalCapacity: capByEvent.get(event.id) ?? 0,
    }];
  });
}

export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  timezone: string;
  occurrences: { startTime: string; endTime: string; originalDate: string }[];
  venueName: string | null;
  onlineLink: string | null;
};

// Unauthenticated read for the public school site. Tenant is resolved by slug
// at the route layer; here we filter strictly to published + public events and
// never touch session-derived state.
export async function listPublicEvents(tenantId: string): Promise<PublicEvent[]> {
  const eventRows = await db.select().from(events)
    .where(and(
      eq(events.tenantId, tenantId),
      eq(events.visibility, 'public'),
      eq(events.lifecycle, 'published'),
    ))
    .orderBy(desc(events.createdAt));
  if (eventRows.length === 0) return [];

  const eventIds = eventRows.map(r => r.id);
  const [schedules, venues] = await Promise.all([
    db.select().from(eventSchedules).where(inArray(eventSchedules.eventId, eventIds)),
    db.select().from(eventVenues).where(inArray(eventVenues.eventId, eventIds)),
  ]);
  const scheduleIds = schedules.map(s => s.id);
  const occurrences = scheduleIds.length
    ? await db.select().from(eventOccurrences)
        .where(and(inArray(eventOccurrences.scheduleId, scheduleIds), eq(eventOccurrences.isCancelled, false)))
    : [];

  const schedulesByEvent = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const list = schedulesByEvent.get(s.eventId) ?? [];
    list.push(s);
    schedulesByEvent.set(s.eventId, list);
  }
  const occurrencesBySchedule = new Map<string, typeof occurrences>();
  for (const o of occurrences) {
    const list = occurrencesBySchedule.get(o.scheduleId) ?? [];
    list.push(o);
    occurrencesBySchedule.set(o.scheduleId, list);
  }
  const venuesByEvent = new Map<string, typeof venues>();
  for (const v of venues) {
    const list = venuesByEvent.get(v.eventId) ?? [];
    list.push(v);
    venuesByEvent.set(v.eventId, list);
  }

  return eventRows.map(ev => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    timezone: ev.timezone,
    occurrences: (schedulesByEvent.get(ev.id) ?? []).flatMap(s =>
      (occurrencesBySchedule.get(s.id) ?? []).map(o => ({
        startTime: o.startTime,
        endTime: o.endTime,
        originalDate: o.originalDate,
      })),
    ).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    venueName: venuesByEvent.get(ev.id)?.[0]?.name ?? null,
    onlineLink: venuesByEvent.get(ev.id)?.[0]?.onlineLink ?? null,
  }));
}

export async function registerForEvent(
  tenantId: string,
  occurrenceId: string,
  personId: string,
  seats: number = 1
) {
  return await db.transaction(async (tx) => {
    // 1. Fetch occurrence scoped to the tenant with a lock to prevent concurrent capacity races
    const [occurrence] = await tx
      .select()
      .from(eventOccurrences)
      .where(and(
        eq(eventOccurrences.id, occurrenceId),
        eq(eventOccurrences.tenantId, tenantId)
      ))
      .limit(1)
      .for('update');

    if (!occurrence) {
      throw new ApiError(404, 'EVENT_OCCURRENCE_NOT_FOUND', 'Occurrence d\'événement introuvable.');
    }

    // 2. Determine capacity (simplified: first venue for the event)
    const [venue] = await tx
      .select({ capacity: eventVenues.capacity })
      .from(eventVenues)
      .where(and(
        eq(eventVenues.eventId, occurrence.eventId),
        eq(eventVenues.tenantId, tenantId)
      ))
      .limit(1);

    const capacity = venue?.capacity;

    if (capacity) {
      // 3. Check current registrations
      const currentRegsResult = await tx
        .select({ totalSeats: sql<number>`SUM(seats)` })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.occurrenceId, occurrenceId),
            eq(eventRegistrations.status, 'going')
          )
        )
        .execute();

      const totalSeats = Number(currentRegsResult[0]?.totalSeats || 0);

      if (totalSeats + seats > capacity) {
        // Automatically put on waitlist instead of throwing an error for capacity
        const [waitlistEntry] = await tx.insert(eventWaitlistEntries).values({
          tenantId,
          occurrenceId,
          personId,
          status: 'queued',
        }).returning();

        return { status: 'waitlisted', entry: waitlistEntry };
      }
    }

    // 4. Register
    // Note: event_registrations_occurrence_person_unique constraint will prevent double registration
    try {
      const [registration] = await tx.insert(eventRegistrations).values({
        tenantId,
        occurrenceId,
        personId,
        status: 'going',
        seats,
      }).returning();

      return { status: 'registered', registration };
    } catch (e: any) {
      // drizzle wraps the pg error in `cause`, so check both levels for the
      // unique-violation code before falling through to the generic 409.
      if (e?.code === '23505' || e?.cause?.code === '23505') {
        throw new ApiError(409, 'ALREADY_REGISTERED', 'Déjà inscrit à cet événement.');
      }
      throw e;
    }
  });
}
