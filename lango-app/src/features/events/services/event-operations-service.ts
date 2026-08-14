import { db } from '@/libs/DB';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  events, eventSchedules, eventOccurrences, eventVenues, eventAudienceRules,
  eventRegistrations, eventWaitlistEntries, eventCheckins, eventAuditEvents,
  eventFeedback, eventTypes, eventTasks, eventIncidents, eventCommunicationJobs,
} from '@/features/events/models/events-schema';
import { ApiError } from '@/libs/api/errors';
import { sendNotification } from '@/libs/services/notification-service';
import type { EventTargetRow } from './audience-service';

// Every helper below re-verifies the parent event belongs to the caller's
// tenant before touching a child row (venues/audiences/tasks/incidents/
// communications) - the #1 real bug class in this codebase per
// future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md §5.
async function assertEventInTenant(tenantId: string, eventId: string): Promise<void> {
  const [ev] = await db.select({ id: events.id }).from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId))).limit(1);
  if (!ev) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
}

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

const MAX_SERIES_OCCURRENCES = 366;
const WAITLIST_OFFER_HOURS = 48;

// DB `timestamp` columns (no timezone) strip the trailing "Z" on write, so a
// value read back is the UTC wall-clock without a zone marker. Re-append "Z"
// when no offset is present so recurrence math stays in a single UTC frame and
// matches the slice(0,10) original_date convention used elsewhere.
function parseUtcString(value: string): Date {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  return new Date(value.replace(' ', 'T') + 'Z');
}

function addInterval(d: Date, rule: RecurrenceRule): Date {
  const next = new Date(d);
  if (rule === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else if (rule === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (rule === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export type ScheduleOccurrenceRow = {
  tenantId: string;
  eventId: string;
  scheduleId: string;
  originalDate: string;
  startTime: string;
  endTime: string;
};

// Pure recurrence expansion shared by createEvent (inside its transaction) and
// the standalone materialization endpoint. `original_date` keeps the UTC date
// portion of the instant, matching the existing slice(0,10) convention.
export function buildOccurrenceRows(
  tenantId: string,
  eventId: string,
  schedule: {
    id: string;
    startTime: string;
    endTime: string;
    recurrenceRule?: RecurrenceRule | null;
    recurrenceEndDate?: string | null;
  },
): ScheduleOccurrenceRow[] {
  const rule = schedule.recurrenceRule ?? 'none';
  const start = parseUtcString(schedule.startTime);
  const end = parseUtcString(schedule.endTime);
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  // Recurrence ends are date-semantic: compare UTC date strings rather than
  // instants, because the write path can drop a few ms off the stored
  // recurrence_end_date and an exact-instant boundary check would then exclude
  // the final occurrence.
  const endLimitDate = schedule.recurrenceEndDate
    ? parseUtcString(schedule.recurrenceEndDate).toISOString().slice(0, 10)
    : null;

  if (rule === 'none') {
    return [{
      tenantId,
      eventId,
      scheduleId: schedule.id,
      originalDate: schedule.startTime.slice(0, 10),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    }];
  }

  const rows: ScheduleOccurrenceRow[] = [];
  let cursor = start;
  let guard = 0;
  while (guard++ < MAX_SERIES_OCCURRENCES) {
    const cursorDate = cursor.toISOString().slice(0, 10);
    if (endLimitDate && cursorDate > endLimitDate) break;
    rows.push({
      tenantId,
      eventId,
      scheduleId: schedule.id,
      originalDate: cursorDate,
      startTime: cursor.toISOString(),
      endTime: new Date(cursor.getTime() + durationMs).toISOString(),
    });
    cursor = addInterval(cursor, rule);
  }
  return rows;
}

export async function materializeOccurrences(
  tenantId: string,
  eventId: string,
  schedule: Parameters<typeof buildOccurrenceRows>[2],
): Promise<{ created: number }> {
  const rows = buildOccurrenceRows(tenantId, eventId, schedule);
  if (rows.length === 0) return { created: 0 };
  const result = await db.insert(eventOccurrences).values(rows)
    .onConflictDoNothing({ target: [eventOccurrences.scheduleId, eventOccurrences.originalDate] });
  return { created: result.rowCount ?? 0 };
}

export type CreateEventTypeInput = {
  name: string;
  style?: Record<string, unknown> | null;
  requiresApproval?: boolean;
  requiresRsvp?: boolean;
  requiresCheckin?: boolean;
};

export async function listEventTypes(tenantId: string) {
  return db.select().from(eventTypes)
    .where(eq(eventTypes.tenantId, tenantId))
    .orderBy(eventTypes.name);
}

export async function createEventType(tenantId: string, input: CreateEventTypeInput) {
  const [row] = await db.insert(eventTypes).values({
    tenantId,
    name: input.name,
    style: input.style ?? null,
    requiresApproval: input.requiresApproval ?? false,
    requiresRsvp: input.requiresRsvp ?? false,
    requiresCheckin: input.requiresCheckin ?? false,
  }).returning();
  return row;
}

export async function publishEvent(tenantId: string, eventId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [ev] = await tx.select().from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
      .for('update');
    if (!ev) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    if (ev.lifecycle === 'cancelled') {
      throw new ApiError(409, 'EVENT_CANCELLED', 'Un événement annulé ne peut pas être publié.');
    }
    if (ev.lifecycle === 'published') return ev;
    const [updated] = await tx.update(events)
      .set({ lifecycle: 'published', publishedAt: new Date().toISOString() })
      .where(eq(events.id, eventId)).returning();
    await tx.insert(eventAuditEvents).values({
      tenantId, eventId, action: 'publish', actorId,
      details: { from: ev.lifecycle, to: 'published' },
    });
    return updated;
  });
}

export async function cancelEvent(tenantId: string, eventId: string, actorId: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const [ev] = await tx.select().from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
      .for('update');
    if (!ev) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    if (ev.lifecycle === 'cancelled') {
      throw new ApiError(409, 'ALREADY_CANCELLED', 'Cet événement est déjà annulé.');
    }
    const [updated] = await tx.update(events)
      .set({
        lifecycle: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason ?? null,
      })
      .where(eq(events.id, eventId)).returning();
    await tx.update(eventOccurrences)
      .set({ isCancelled: true })
      .where(and(eq(eventOccurrences.eventId, eventId), eq(eventOccurrences.tenantId, tenantId)));
    await tx.insert(eventAuditEvents).values({
      tenantId, eventId, action: 'cancel', actorId,
      details: { reason: reason ?? null },
    });
    return updated;
  });
}

export async function checkinOccurrence(input: {
  tenantId: string;
  occurrenceId: string;
  personId: string;
  operatorId: string | null;
  method?: 'qr' | 'manual_search' | 'self_service';
  registrationId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [occurrence] = await tx.select().from(eventOccurrences)
      .where(and(eq(eventOccurrences.id, input.occurrenceId), eq(eventOccurrences.tenantId, input.tenantId)))
      .for('update');
    if (!occurrence) throw new ApiError(404, 'EVENT_OCCURRENCE_NOT_FOUND', 'Occurrence d\'événement introuvable.');

    const [existing] = await tx.select().from(eventCheckins)
      .where(and(eq(eventCheckins.occurrenceId, input.occurrenceId), eq(eventCheckins.personId, input.personId)))
      .limit(1);
    if (existing) return { checkin: existing, duplicated: true };

    let registrationId = input.registrationId ?? null;
    if (!registrationId) {
      const [reg] = await tx.select({ id: eventRegistrations.id }).from(eventRegistrations)
        .where(and(
          eq(eventRegistrations.occurrenceId, input.occurrenceId),
          eq(eventRegistrations.personId, input.personId),
          eq(eventRegistrations.status, 'going'),
        )).limit(1);
      registrationId = reg?.id ?? null;
    }

    const [checkin] = await tx.insert(eventCheckins).values({
      tenantId: input.tenantId,
      occurrenceId: input.occurrenceId,
      registrationId,
      personId: input.personId,
      method: input.method ?? 'manual_search',
      operatorId: input.operatorId,
    }).returning();
    await tx.insert(eventAuditEvents).values({
      tenantId: input.tenantId,
      eventId: occurrence.eventId,
      action: 'checkin',
      actorId: input.operatorId ?? input.personId,
      details: { occurrenceId: input.occurrenceId, personId: input.personId },
    });
    return { checkin, duplicated: false };
  });
}

// Staff-facing attendee list for an event (all occurrences). Attendee lists
// carry registration answers/consent, so this is deliberately gated to
// events.registration.manage at the route layer, not events.read.
export async function listEventRegistrations(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select({
    id: eventRegistrations.id,
    occurrenceId: eventRegistrations.occurrenceId,
    personId: eventRegistrations.personId,
    status: eventRegistrations.status,
    seats: eventRegistrations.seats,
    answers: eventRegistrations.answers,
    consentGiven: eventRegistrations.consentGiven,
    createdAt: eventRegistrations.createdAt,
    updatedAt: eventRegistrations.updatedAt,
  })
    .from(eventRegistrations)
    .innerJoin(eventOccurrences, eq(eventRegistrations.occurrenceId, eventOccurrences.id))
    .where(and(eq(eventOccurrences.eventId, eventId), eq(eventOccurrences.tenantId, tenantId)))
    .orderBy(eventRegistrations.createdAt);
}

export async function listOccurrenceCheckins(tenantId: string, occurrenceId: string) {
  return db.select().from(eventCheckins)
    .where(and(eq(eventCheckins.occurrenceId, occurrenceId), eq(eventCheckins.tenantId, tenantId)))
    .orderBy(eventCheckins.timestamp);
}

export async function listWaitlist(tenantId: string, occurrenceId: string) {
  return db.select().from(eventWaitlistEntries)
    .where(and(eq(eventWaitlistEntries.occurrenceId, occurrenceId), eq(eventWaitlistEntries.tenantId, tenantId)))
    .orderBy(eventWaitlistEntries.queuedAt);
}

// Promote the next queued entry to an expiring offer after a seat frees up.
export async function promoteNextWaitlist(tenantId: string, occurrenceId: string) {
  return db.transaction(async (tx) => {
    const [nextQueued] = await tx.select().from(eventWaitlistEntries)
      .where(and(
        eq(eventWaitlistEntries.occurrenceId, occurrenceId),
        eq(eventWaitlistEntries.tenantId, tenantId),
        eq(eventWaitlistEntries.status, 'queued'),
      ))
      .orderBy(eventWaitlistEntries.queuedAt)
      .limit(1)
      .for('update');
    if (!nextQueued) return null;
    const [updated] = await tx.update(eventWaitlistEntries)
      .set({
        status: 'offered',
        offerExpiresAt: new Date(Date.now() + WAITLIST_OFFER_HOURS * 3600 * 1000).toISOString(),
      })
      .where(eq(eventWaitlistEntries.id, nextQueued.id)).returning();
    return updated;
  });
}

// `restrictToPersonId` is set by the route when the caller lacks
// events.registration.manage - it then may only cancel their OWN
// registration (self-service RSVP cancel). Staff with the manage capability
// pass undefined and may cancel any registration in the tenant.
export async function cancelRegistration(
  tenantId: string,
  registrationId: string,
  actorId: string,
  restrictToPersonId?: string,
) {
  return db.transaction(async (tx) => {
    const [reg] = await tx.select().from(eventRegistrations)
      .where(and(eq(eventRegistrations.id, registrationId), eq(eventRegistrations.tenantId, tenantId)))
      .for('update');
    if (!reg) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Inscription introuvable.');
    if (restrictToPersonId && reg.personId !== restrictToPersonId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez annuler que votre propre inscription.');
    }
    if (reg.status === 'cancelled') return { registration: reg, promoted: null };
    const [occurrence] = await tx.select({ eventId: eventOccurrences.eventId }).from(eventOccurrences)
      .where(eq(eventOccurrences.id, reg.occurrenceId)).limit(1);
    const [updated] = await tx.update(eventRegistrations)
      .set({ status: 'cancelled' })
      .where(eq(eventRegistrations.id, registrationId)).returning();
    await tx.update(eventWaitlistEntries)
      .set({ status: 'expired' })
      .where(and(eq(eventWaitlistEntries.occurrenceId, reg.occurrenceId), eq(eventWaitlistEntries.personId, reg.personId)));
    if (occurrence) {
      await tx.insert(eventAuditEvents).values({
        tenantId,
        eventId: occurrence.eventId,
        action: 'registration',
        actorId,
        details: { registrationId, status: 'cancelled' },
      });
    }
    const promoted = await promoteNextWaitlist(tenantId, reg.occurrenceId);
    return { registration: updated, promoted };
  });
}

export async function respondToWaitlistOffer(
  tenantId: string,
  waitlistId: string,
  personId: string,
  action: 'accept' | 'decline',
) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(eventWaitlistEntries)
      .where(and(
        eq(eventWaitlistEntries.id, waitlistId),
        eq(eventWaitlistEntries.tenantId, tenantId),
        eq(eventWaitlistEntries.personId, personId),
      ))
      .for('update');
    if (!entry) throw new ApiError(404, 'WAITLIST_ENTRY_NOT_FOUND', 'Entrée de liste d\'attente introuvable.');

    if (entry.status !== 'offered') {
      if (entry.status === 'expired') {
        throw new ApiError(410, 'WAITLIST_OFFER_EXPIRED', 'L\'offre de liste d\'attente a expiré.');
      }
      throw new ApiError(409, 'WAITLIST_NOT_OFFERED', 'Cette entrée n\'a pas d\'offre en attente.');
    }
    if (entry.offerExpiresAt && new Date(entry.offerExpiresAt).getTime() < Date.now()) {
      await tx.update(eventWaitlistEntries).set({ status: 'expired' }).where(eq(eventWaitlistEntries.id, waitlistId));
      throw new ApiError(410, 'WAITLIST_OFFER_EXPIRED', 'L\'offre de liste d\'attente a expiré.');
    }

    if (action === 'decline') {
      const [updated] = await tx.update(eventWaitlistEntries)
        .set({ status: 'declined' }).where(eq(eventWaitlistEntries.id, waitlistId)).returning();
      return { status: 'declined', entry: updated };
    }

    let registration;
    try {
      const [r] = await tx.insert(eventRegistrations).values({
        tenantId,
        occurrenceId: entry.occurrenceId,
        personId,
        status: 'going',
        seats: 1,
      }).returning();
      registration = r;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code !== '23505') throw e;
      const [r] = await tx.select().from(eventRegistrations)
        .where(and(eq(eventRegistrations.occurrenceId, entry.occurrenceId), eq(eventRegistrations.personId, personId)))
        .limit(1);
      registration = r;
    }

    const [updated] = await tx.update(eventWaitlistEntries)
      .set({ status: 'accepted' }).where(eq(eventWaitlistEntries.id, waitlistId)).returning();
    return { status: 'accepted', registration, entry: updated };
  });
}

export type EventReportRow = {
  eventId: string;
  title: string;
  lifecycle: string;
  occurrences: number;
  totalCapacity: number;
  registeredSeats: number;
  waitlisted: number;
  checkedIn: number;
  attendanceRate: number | null;
  averageRating: number | null;
  feedbackCount: number;
};

export async function getEventReports(tenantId: string): Promise<EventReportRow[]> {
  const eventRows = await db.select({ id: events.id, title: events.title, lifecycle: events.lifecycle })
    .from(events).where(eq(events.tenantId, tenantId)).orderBy(events.createdAt);
  if (eventRows.length === 0) return [];
  const eventIds = eventRows.map(r => r.id);

  const [occRows, regRows, capRows, checkinRows, fbRows, wlRows] = await Promise.all([
    db.select({ eventId: eventOccurrences.eventId, n: sql<number>`count(*)` })
      .from(eventOccurrences)
      .where(and(inArray(eventOccurrences.eventId, eventIds), eq(eventOccurrences.isCancelled, false)))
      .groupBy(eventOccurrences.eventId),
    db.select({
      eventId: eventOccurrences.eventId,
      registeredSeats: sql<number>`COALESCE(SUM(${eventRegistrations.seats}) FILTER (WHERE ${eventRegistrations.status} = 'going'), 0)`,
    })
      .from(eventRegistrations)
      .innerJoin(eventOccurrences, eq(eventRegistrations.occurrenceId, eventOccurrences.id))
      .where(inArray(eventOccurrences.eventId, eventIds))
      .groupBy(eventOccurrences.eventId),
    db.select({ eventId: eventVenues.eventId, totalCapacity: sql<number>`COALESCE(SUM(${eventVenues.capacity}), 0)` })
      .from(eventVenues).where(inArray(eventVenues.eventId, eventIds)).groupBy(eventVenues.eventId),
    db.select({ eventId: eventOccurrences.eventId, n: sql<number>`count(*)` })
      .from(eventCheckins)
      .innerJoin(eventOccurrences, eq(eventCheckins.occurrenceId, eventOccurrences.id))
      .where(inArray(eventOccurrences.eventId, eventIds))
      .groupBy(eventOccurrences.eventId),
    db.select({ eventId: eventFeedback.eventId, avg: sql<number>`AVG(${eventFeedback.rating})`, n: sql<number>`count(*)` })
      .from(eventFeedback)
      .where(and(inArray(eventFeedback.eventId, eventIds), sql`${eventFeedback.rating} IS NOT NULL`))
      .groupBy(eventFeedback.eventId),
    db.select({ eventId: eventOccurrences.eventId, n: sql<number>`count(*)` })
      .from(eventWaitlistEntries)
      .innerJoin(eventOccurrences, eq(eventWaitlistEntries.occurrenceId, eventOccurrences.id))
      .where(and(inArray(eventOccurrences.eventId, eventIds), inArray(eventWaitlistEntries.status, ['queued', 'offered'])))
      .groupBy(eventOccurrences.eventId),
  ]);

  const occByEvent = new Map(occRows.map(r => [r.eventId, Number(r.n) || 0]));
  const regByEvent = new Map(regRows.map(r => [r.eventId, Number(r.registeredSeats) || 0]));
  const capByEvent = new Map(capRows.map(r => [r.eventId, Number(r.totalCapacity) || 0]));
  const checkinByEvent = new Map(checkinRows.map(r => [r.eventId, Number(r.n) || 0]));
  const fbByEvent = new Map(fbRows.map(r => [r.eventId, { avg: r.avg === null ? null : Number(r.avg), n: Number(r.n) || 0 }]));
  const wlByEvent = new Map(wlRows.map(r => [r.eventId, Number(r.n) || 0]));

  return eventRows.map(ev => {
    const registered = regByEvent.get(ev.id) ?? 0;
    const checkedIn = checkinByEvent.get(ev.id) ?? 0;
    const fb = fbByEvent.get(ev.id);
    return {
      eventId: ev.id,
      title: ev.title,
      lifecycle: ev.lifecycle,
      occurrences: occByEvent.get(ev.id) ?? 0,
      totalCapacity: capByEvent.get(ev.id) ?? 0,
      registeredSeats: registered,
      waitlisted: wlByEvent.get(ev.id) ?? 0,
      checkedIn,
      attendanceRate: registered > 0 ? Math.round((checkedIn / registered) * 1000) / 10 : null,
      averageRating: fb?.avg === null || fb?.avg === undefined ? null : Math.round((fb.avg as number) * 10) / 10,
      feedbackCount: fb?.n ?? 0,
    };
  });
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
}

export async function buildEventIcs(tenantId: string, eventId: string): Promise<string> {
  const [event] = await db.select().from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId))).limit(1);
  if (!event) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');

  const [schedules, venues] = await Promise.all([
    db.select().from(eventSchedules).where(eq(eventSchedules.eventId, eventId)),
    db.select().from(eventVenues).where(eq(eventVenues.eventId, eventId)),
  ]);
  const scheduleIds = schedules.map(s => s.id);
  const occurrences = scheduleIds.length
    ? await db.select().from(eventOccurrences)
        .where(and(inArray(eventOccurrences.scheduleId, scheduleIds), eq(eventOccurrences.isCancelled, false)))
    : [];

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lango//SchoolOS Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const venueName = venues[0]?.name ?? null;
  for (const occ of occurrences) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${occ.id}@lango`);
    lines.push(`DTSTAMP:${icsDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${icsDate(occ.startTime)}`);
    lines.push(`DTEND:${icsDate(occ.endTime)}`);
    lines.push(`SUMMARY:${icsEscape(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    if (venueName) lines.push(`LOCATION:${icsEscape(venueName)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function getEventDetail(tenantId: string, eventId: string) {
  const [event] = await db.select().from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId))).limit(1);
  if (!event) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');

  const [schedules, venues, rules, regs] = await Promise.all([
    db.select().from(eventSchedules).where(eq(eventSchedules.eventId, eventId)),
    db.select().from(eventVenues).where(eq(eventVenues.eventId, eventId)),
    db.select().from(eventAudienceRules).where(eq(eventAudienceRules.eventId, eventId)),
    db.select({ status: eventRegistrations.status, seats: eventRegistrations.seats, n: sql<number>`count(*)` })
      .from(eventRegistrations)
      .innerJoin(eventOccurrences, eq(eventRegistrations.occurrenceId, eventOccurrences.id))
      .where(eq(eventOccurrences.eventId, eventId))
      .groupBy(eventRegistrations.status, eventRegistrations.seats),
  ]);
  const scheduleIds = schedules.map(s => s.id);
  const occurrences = scheduleIds.length
    ? await db.select().from(eventOccurrences)
        .where(and(inArray(eventOccurrences.scheduleId, scheduleIds), eq(eventOccurrences.tenantId, tenantId)))
        .orderBy(eventOccurrences.startTime)
    : [];

  return { event, schedules, occurrences, venues, rules, registrationSummary: regs };
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export type CreateVenueInput = {
  venueType?: 'physical' | 'online' | 'hybrid';
  name?: string;
  address?: string;
  capacity?: number;
  onlineLink?: string;
  accessibilityNotes?: string;
  occurrenceId?: string | null;
};

export async function listEventVenues(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventVenues)
    .where(and(eq(eventVenues.eventId, eventId), eq(eventVenues.tenantId, tenantId)));
}

export async function addEventVenue(tenantId: string, eventId: string, input: CreateVenueInput) {
  await assertEventInTenant(tenantId, eventId);
  if (input.occurrenceId) {
    const [occ] = await db.select({ id: eventOccurrences.id }).from(eventOccurrences)
      .where(and(eq(eventOccurrences.id, input.occurrenceId), eq(eventOccurrences.eventId, eventId), eq(eventOccurrences.tenantId, tenantId)))
      .limit(1);
    if (!occ) throw new ApiError(404, 'EVENT_OCCURRENCE_NOT_FOUND', 'Occurrence d\'événement introuvable.');
  }
  const [row] = await db.insert(eventVenues).values({
    tenantId,
    eventId,
    occurrenceId: input.occurrenceId ?? null,
    venueType: input.venueType ?? 'physical',
    name: input.name,
    address: input.address,
    capacity: input.capacity,
    onlineLink: input.onlineLink,
    accessibilityNotes: input.accessibilityNotes,
  }).returning();
  return row;
}

export async function updateEventVenue(tenantId: string, eventId: string, venueId: string, input: Partial<CreateVenueInput>) {
  await assertEventInTenant(tenantId, eventId);
  const [existing] = await db.select({ id: eventVenues.id }).from(eventVenues)
    .where(and(eq(eventVenues.id, venueId), eq(eventVenues.eventId, eventId), eq(eventVenues.tenantId, tenantId))).limit(1);
  if (!existing) throw new ApiError(404, 'EVENT_VENUE_NOT_FOUND', 'Lieu introuvable.');
  const [row] = await db.update(eventVenues).set({
    ...(input.venueType !== undefined ? { venueType: input.venueType } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.onlineLink !== undefined ? { onlineLink: input.onlineLink } : {}),
    ...(input.accessibilityNotes !== undefined ? { accessibilityNotes: input.accessibilityNotes } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(eventVenues.id, venueId)).returning();
  return row;
}

export async function deleteEventVenue(tenantId: string, eventId: string, venueId: string) {
  await assertEventInTenant(tenantId, eventId);
  const result = await db.delete(eventVenues)
    .where(and(eq(eventVenues.id, venueId), eq(eventVenues.eventId, eventId), eq(eventVenues.tenantId, tenantId)));
  if (!result.rowCount) throw new ApiError(404, 'EVENT_VENUE_NOT_FOUND', 'Lieu introuvable.');
}

// ---------------------------------------------------------------------------
// Audience rules
// ---------------------------------------------------------------------------

export async function listEventAudienceRules(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventAudienceRules)
    .where(and(eq(eventAudienceRules.eventId, eventId), eq(eventAudienceRules.tenantId, tenantId)));
}

export async function addEventAudienceRule(tenantId: string, eventId: string, rule: EventTargetRow) {
  await assertEventInTenant(tenantId, eventId);
  const [row] = await db.insert(eventAudienceRules).values({
    tenantId,
    eventId,
    targetKind: rule.targetKind,
    targetRoleValue: rule.targetRoleValue,
    targetRefId: rule.targetRefId,
  }).returning();
  return row;
}

export async function removeEventAudienceRule(tenantId: string, eventId: string, ruleId: string) {
  await assertEventInTenant(tenantId, eventId);
  const result = await db.delete(eventAudienceRules)
    .where(and(eq(eventAudienceRules.id, ruleId), eq(eventAudienceRules.eventId, eventId), eq(eventAudienceRules.tenantId, tenantId)));
  if (!result.rowCount) throw new ApiError(404, 'EVENT_AUDIENCE_RULE_NOT_FOUND', 'Règle d\'audience introuvable.');
}

// ---------------------------------------------------------------------------
// Tasks (operations checklist)
// ---------------------------------------------------------------------------

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  occurrenceId?: string | null;
  dueAt?: string | null;
  assigneeId?: string | null;
};

export async function listEventTasks(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventTasks)
    .where(and(eq(eventTasks.eventId, eventId), eq(eventTasks.tenantId, tenantId)))
    .orderBy(eventTasks.createdAt);
}

export async function createEventTask(tenantId: string, eventId: string, createdById: string, input: CreateTaskInput) {
  await assertEventInTenant(tenantId, eventId);
  const [row] = await db.insert(eventTasks).values({
    tenantId,
    eventId,
    occurrenceId: input.occurrenceId ?? null,
    title: input.title,
    description: input.description ?? null,
    dueAt: input.dueAt ?? null,
    assigneeId: input.assigneeId ?? null,
    createdById,
  }).returning();
  return row;
}

export async function updateEventTask(
  tenantId: string,
  eventId: string,
  taskId: string,
  input: { status?: 'todo' | 'in_progress' | 'done' | 'cancelled'; title?: string; description?: string | null; dueAt?: string | null; assigneeId?: string | null },
) {
  await assertEventInTenant(tenantId, eventId);
  const [existing] = await db.select().from(eventTasks)
    .where(and(eq(eventTasks.id, taskId), eq(eventTasks.eventId, eventId), eq(eventTasks.tenantId, tenantId))).limit(1);
  if (!existing) throw new ApiError(404, 'EVENT_TASK_NOT_FOUND', 'Tâche introuvable.');
  const [row] = await db.update(eventTasks).set({
    ...(input.status !== undefined ? { status: input.status, completedAt: input.status === 'done' ? new Date().toISOString() : existing.completedAt } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(eventTasks.id, taskId)).returning();
  return row;
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export type CreateIncidentInput = {
  title: string;
  description?: string | null;
  occurrenceId?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical';
};

export async function listEventIncidents(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventIncidents)
    .where(and(eq(eventIncidents.eventId, eventId), eq(eventIncidents.tenantId, tenantId)))
    .orderBy(eventIncidents.createdAt);
}

export async function reportEventIncident(tenantId: string, eventId: string, reportedById: string, input: CreateIncidentInput) {
  await assertEventInTenant(tenantId, eventId);
  const [row] = await db.insert(eventIncidents).values({
    tenantId,
    eventId,
    occurrenceId: input.occurrenceId ?? null,
    title: input.title,
    description: input.description ?? null,
    severity: input.severity ?? 'medium',
    reportedById,
  }).returning();
  return row;
}

export async function updateEventIncident(
  tenantId: string,
  eventId: string,
  incidentId: string,
  resolvedById: string,
  input: { status?: 'open' | 'resolving' | 'resolved' | 'closed'; description?: string | null; severity?: 'low' | 'medium' | 'high' | 'critical' },
) {
  await assertEventInTenant(tenantId, eventId);
  const [existing] = await db.select().from(eventIncidents)
    .where(and(eq(eventIncidents.id, incidentId), eq(eventIncidents.eventId, eventId), eq(eventIncidents.tenantId, tenantId))).limit(1);
  if (!existing) throw new ApiError(404, 'EVENT_INCIDENT_NOT_FOUND', 'Incident introuvable.');
  const resolving = input.status === 'resolved' || input.status === 'closed';
  const [row] = await db.update(eventIncidents).set({
    ...(input.status !== undefined ? {
      status: input.status,
      resolvedById: resolving ? resolvedById : existing.resolvedById,
      resolvedAt: resolving ? (existing.resolvedAt ?? new Date().toISOString()) : existing.resolvedAt,
    } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.severity !== undefined ? { severity: input.severity } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(eventIncidents.id, incidentId)).returning();
  return row;
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export async function listEventFeedback(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventFeedback)
    .where(and(eq(eventFeedback.eventId, eventId), eq(eventFeedback.tenantId, tenantId)))
    .orderBy(eventFeedback.createdAt);
}

export async function submitEventFeedback(
  tenantId: string,
  eventId: string,
  personId: string,
  input: { rating?: number | null; comment?: string | null; occurrenceId?: string | null },
) {
  await assertEventInTenant(tenantId, eventId);
  const [row] = await db.insert(eventFeedback).values({
    tenantId,
    eventId,
    occurrenceId: input.occurrenceId ?? null,
    personId,
    rating: input.rating ?? null,
    comment: input.comment ?? null,
    createdById: personId,
  }).returning();
  return row;
}

export async function moderateEventFeedback(
  tenantId: string,
  eventId: string,
  feedbackId: string,
  status: 'pending' | 'published' | 'hidden',
) {
  await assertEventInTenant(tenantId, eventId);
  const [existing] = await db.select({ id: eventFeedback.id }).from(eventFeedback)
    .where(and(eq(eventFeedback.id, feedbackId), eq(eventFeedback.eventId, eventId), eq(eventFeedback.tenantId, tenantId))).limit(1);
  if (!existing) throw new ApiError(404, 'EVENT_FEEDBACK_NOT_FOUND', 'Avis introuvable.');
  const [row] = await db.update(eventFeedback).set({ status, updatedAt: new Date().toISOString() })
    .where(eq(eventFeedback.id, feedbackId)).returning();
  return row;
}

// ---------------------------------------------------------------------------
// Communications
//
// Scope note: this targets the event's *confirmed registrants* (a concrete,
// already-known person-id list), not a full audience-rule -> user-list
// resolver. Building a general resolver (role/class_section/class_offering ->
// every matching user id) is a materially larger feature that nothing else
// in this service needs yet; deferred and written down here rather than
// faked. Delivery reuses the existing in-app notification outbox
// (`src/libs/services/notification-service.ts`) - no new queue/worker is
// introduced, matching this repo's "no queue unless justified" discipline.
// ---------------------------------------------------------------------------

async function listEventRegistrantIds(tenantId: string, eventId: string): Promise<string[]> {
  const rows = await db.selectDistinct({ personId: eventRegistrations.personId })
    .from(eventRegistrations)
    .innerJoin(eventOccurrences, eq(eventRegistrations.occurrenceId, eventOccurrences.id))
    .where(and(
      eq(eventOccurrences.eventId, eventId),
      eq(eventOccurrences.tenantId, tenantId),
      eq(eventRegistrations.status, 'going'),
    ));
  return rows.map(r => r.personId);
}

export async function listEventCommunications(tenantId: string, eventId: string) {
  await assertEventInTenant(tenantId, eventId);
  return db.select().from(eventCommunicationJobs)
    .where(and(eq(eventCommunicationJobs.eventId, eventId), eq(eventCommunicationJobs.tenantId, tenantId)))
    .orderBy(eventCommunicationJobs.createdAt);
}

export async function sendEventCommunication(
  tenantId: string,
  eventId: string,
  input: { kind: 'reminder' | 'invitation' | 'announcement' | 'cancellation' | 'feedback_request'; message: string },
) {
  const [event] = await db.select({ id: events.id, title: events.title }).from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId))).limit(1);
  if (!event) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');

  const recipientIds = await listEventRegistrantIds(tenantId, eventId);

  const [job] = await db.insert(eventCommunicationJobs).values({
    tenantId,
    eventId,
    kind: input.kind,
    payload: { message: input.message, recipientCount: recipientIds.length },
    status: recipientIds.length > 0 ? 'sent' : 'failed',
    sentAt: recipientIds.length > 0 ? new Date().toISOString() : null,
    error: recipientIds.length === 0 ? 'Aucun inscrit confirmé à notifier.' : null,
  }).returning();

  await Promise.all(recipientIds.map(recipientId => sendNotification({
    tenantId,
    recipientId,
    template: `event_${input.kind}`,
    channel: 'in_app',
    data: { eventId, eventTitle: event.title, message: input.message },
  })));

  return job;
}
