import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';
import { events, eventSchedules, eventOccurrences, eventRegistrations, eventWaitlistEntries } from '../models/events-schema';
import { createEvent, registerForEvent } from './events-service';
import {
  buildEventIcs, cancelEvent, cancelRegistration, checkinOccurrence, createEventType,
  getEventReports, listEventTypes, materializeOccurrences, publishEvent, respondToWaitlistOffer,
} from './event-operations-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('events operations service', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  const ownerId = `evt-owner-${suffix}`;
  const attendeeA = `evt-a-${suffix}`;
  const attendeeB = `evt-b-${suffix}`;

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Events Test ${suffix}`, slug: `events-test-${suffix}` }).returning();
    tenantId = tenant!.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) {
      // events are tenant_id text (no FK to tenants); deleting the events rows
      // cascades to schedules/occurrences/venues/rules/registrations/waitlist/checkins/audit.
      await db.delete(events).where(eq(events.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  }, 30_000);

  async function makeEvent(opts?: {
    title?: string;
    capacity?: number;
    recurrenceRule?: 'daily' | 'weekly' | 'monthly';
    recurrenceEndDate?: string;
    daysFromNow?: number;
  }) {
    // Derive start/end/recurrence-end from a SINGLE instant so recurrence
    // boundary math in the test is exact (a second new Date() would differ by
    // a few ms and flip the inclusive-boundary assertion).
    const startMs = Date.now() + (opts?.daysFromNow ?? 1) * 86400_000;
    const start = new Date(startMs).toISOString();
    const end = new Date(startMs + 3600_000).toISOString();
    const recurrence = opts?.recurrenceRule ?? 'none';
    const event = await createEvent({
      tenantId,
      ownerId,
      title: opts?.title ?? 'Test Event',
      schedules: [{
        startTime: start,
        endTime: end,
        recurrenceRule: recurrence,
        recurrenceEndDate: opts?.recurrenceEndDate ?? (recurrence !== 'none' ? new Date(startMs + 21 * 86400_000).toISOString() : undefined),
      }],
      venues: opts?.capacity ? [{ venueType: 'physical', name: 'Salle A', capacity: opts.capacity }] : [],
    });
    const [occurrence] = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, event!.id)).limit(1);
    return { event: event!, occurrence: occurrence! };
  }

  it('creates and lists event types', async () => {
    const created = await createEventType(tenantId, { name: 'Conférence', requiresRsvp: true });
    expect(created!.id).toBeTruthy();
    expect(created!.name).toBe('Conférence');
    const list = await listEventTypes(tenantId);
    expect(list.map(t => t.name)).toContain('Conférence');
  });

  it('expands a weekly recurrence into occurrences and is idempotent', async () => {
    const { event } = await makeEvent({ title: 'Weekly Club', recurrenceRule: 'weekly' });
    const [schedule] = await db.select().from(eventSchedules).where(eq(eventSchedules.eventId, event.id)).limit(1);
    // createEvent materialized 4 occurrences (start + 3 weekly)
    const before = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, event.id));
    expect(before.length).toBe(4);

    const rerun = await materializeOccurrences(tenantId, event.id, schedule!);
    expect(rerun.created).toBe(0);
    const after = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, event.id));
    expect(after.length).toBe(4);
  });

  it('publishes a draft event', async () => {
    const { event } = await makeEvent({ title: 'Publish Me' });
    expect(event.lifecycle).toBe('draft');
    const published = await publishEvent(tenantId, event.id, ownerId);
    expect(published!.lifecycle).toBe('published');
    expect(published!.publishedAt).toBeTruthy();
  });

  it('cancels an event and its occurrences, and rejects re-cancel / publish-after-cancel', async () => {
    const { event } = await makeEvent({ title: 'Cancel Me' });
    await publishEvent(tenantId, event.id, ownerId);
    const cancelled = await cancelEvent(tenantId, event.id, ownerId, 'Weather');
    expect(cancelled!.lifecycle).toBe('cancelled');
    expect(cancelled!.cancellationReason).toBe('Weather');
    const occs = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, event.id));
    expect(occs.every(o => o.isCancelled)).toBe(true);

    await expect(cancelEvent(tenantId, event.id, ownerId)).rejects.toMatchObject({ code: 'ALREADY_CANCELLED' });
    await expect(publishEvent(tenantId, event.id, ownerId)).rejects.toMatchObject({ code: 'EVENT_CANCELLED' });
  });

  it('checks in once and returns the existing check-in on a duplicate scan', async () => {
    const { event, occurrence } = await makeEvent({ title: 'Checkin Event', capacity: 2 });
    await publishEvent(tenantId, event.id, ownerId);
    await registerForEvent(tenantId, occurrence.id, attendeeA);

    const first = await checkinOccurrence({ tenantId, occurrenceId: occurrence.id, personId: attendeeA, operatorId: ownerId });
    expect(first.duplicated).toBe(false);
    expect(first.checkin!.id).toBeTruthy();

    const second = await checkinOccurrence({ tenantId, occurrenceId: occurrence.id, personId: attendeeA, operatorId: ownerId });
    expect(second.duplicated).toBe(true);
    expect(second.checkin!.id).toBe(first.checkin!.id);
  });

  it('waitlists when capacity is exhausted, promotes on cancellation, and lets the person accept', async () => {
    const { event, occurrence } = await makeEvent({ title: 'Waitlist Event', capacity: 1 });
    await publishEvent(tenantId, event.id, ownerId);

    const aReg = await registerForEvent(tenantId, occurrence.id, attendeeA);
    expect(aReg.status).toBe('registered');
    const bReg = await registerForEvent(tenantId, occurrence.id, attendeeB);
    expect(bReg.status).toBe('waitlisted');

    const waitlistId = (bReg as { entry: { id: string } }).entry.id;
    const cancelled = await cancelRegistration(tenantId, (aReg as { registration: { id: string } }).registration.id, ownerId);
    expect(cancelled.promoted?.status).toBe('offered');
    expect(cancelled.promoted?.offerExpiresAt).toBeTruthy();

    const accepted = await respondToWaitlistOffer(tenantId, waitlistId, attendeeB, 'accept');
    expect(accepted.status).toBe('accepted');
    expect((accepted as { registration: { personId: string } }).registration.personId).toBe(attendeeB);
  });

  it('rejects an expired waitlist offer', async () => {
    const { occurrence } = await makeEvent({ title: 'Expiry Event', capacity: 1 });
    const [entry] = await db.insert(eventWaitlistEntries).values({
      tenantId,
      occurrenceId: occurrence.id,
      personId: attendeeA,
      status: 'offered',
      offerExpiresAt: new Date(Date.now() - 3600_000).toISOString(),
    }).returning();
    await expect(respondToWaitlistOffer(tenantId, entry!.id, attendeeA, 'accept')).rejects.toMatchObject({ code: 'WAITLIST_OFFER_EXPIRED' });
  });

  // The capacity-race regression test: registerForEvent (events-service.ts)
  // takes a `SELECT ... FOR UPDATE` lock on the occurrence row before reading
  // the capacity SUM, so concurrent transactions on the SAME occurrence
  // serialize instead of interleaving. Without that lock, N simultaneous
  // requests can each read the pre-registration SUM, all see room, and all
  // insert - overselling a capacity-1 event. Fire N at once and assert
  // exactly one wins the seat and the rest waitlist.
  it('serializes N concurrent registrations against a capacity-1 occurrence: exactly one registers', async () => {
    const { occurrence } = await makeEvent({ title: 'Race Event', capacity: 1 });
    const N = 10;
    const attendees = Array.from({ length: N }, (_, i) => `evt-race-${suffix}-${i}`);

    const results = await Promise.all(
      attendees.map(personId => registerForEvent(tenantId, occurrence.id, personId)),
    );

    const registered = results.filter(r => r.status === 'registered');
    const waitlisted = results.filter(r => r.status === 'waitlisted');
    expect(registered.length).toBe(1);
    expect(waitlisted.length).toBe(N - 1);

    // Verify against the DB directly, not just the in-memory return values -
    // this is the assertion that would fail if the lock were removed and two
    // transactions both committed a 'going' row for the same seat.
    const goingRows = await db.select().from(eventRegistrations)
      .where(and(eq(eventRegistrations.occurrenceId, occurrence.id), eq(eventRegistrations.status, 'going')));
    expect(goingRows.length).toBe(1);

    const waitlistRows = await db.select().from(eventWaitlistEntries)
      .where(eq(eventWaitlistEntries.occurrenceId, occurrence.id));
    expect(waitlistRows.length).toBe(N - 1);
  });

  // The N-simultaneous-Promise.all test above proved the *outcome* is always
  // correct, but on a fast local Postgres the individual transactions are
  // short enough that they were observed to serialize "naturally" even with
  // the `.for('update')` lock temporarily removed during manual verification
  // (each transaction round-trips in under a millisecond, so 10 Node-side
  // "concurrent" calls rarely land two SELECTs inside the same open window).
  // That makes the outcome-only test an unreliable regression signal on its
  // own. This test proves the actual mechanism deterministically: hold the
  // occurrence row's FOR UPDATE lock open with an artificial delay in one
  // transaction, and assert a second transaction's attempt to take the same
  // lock only resolves AFTER the first commits - the exact serialization
  // registerForEvent depends on to make the capacity check race-free.
  it('a held FOR UPDATE lock on the occurrence row blocks a second transaction until the first commits', async () => {
    const { occurrence } = await makeEvent({ title: 'Lock Proof Event', capacity: 5 });
    const order: string[] = [];

    let aLockedResolve!: () => void;
    const aLockedPromise = new Promise<void>((resolve) => {
      aLockedResolve = resolve;
    });

    const txA = db.transaction(async (tx) => {
      await tx.select().from(eventOccurrences).where(eq(eventOccurrences.id, occurrence.id)).for('update');
      order.push('A-locked');
      aLockedResolve();
      await new Promise(resolve => setTimeout(resolve, 300));
      order.push('A-commit');
    });

    // Wait until A has definitively acquired the FOR UPDATE lock
    await aLockedPromise;

    const txB = db.transaction(async (tx) => {
      order.push('B-attempt');
      await tx.select().from(eventOccurrences).where(eq(eventOccurrences.id, occurrence.id)).for('update');
      order.push('B-locked');
    });

    await Promise.all([txA, txB]);

    expect(order.indexOf('A-locked')).toBeLessThan(order.indexOf('B-attempt'));
    // The proof: B could not acquire the lock until AFTER A committed.
    expect(order.indexOf('B-locked')).toBeGreaterThan(order.indexOf('A-commit'));
  });

  it('reports registration, capacity, check-in and attendance metrics', async () => {
    const { event, occurrence } = await makeEvent({ title: 'Report Event', capacity: 4 });
    await publishEvent(tenantId, event.id, ownerId);
    await registerForEvent(tenantId, occurrence.id, attendeeA);
    await checkinOccurrence({ tenantId, occurrenceId: occurrence.id, personId: attendeeA, operatorId: ownerId });

    const reports = await getEventReports(tenantId);
    const row = reports.find(r => r.eventId === event.id);
    expect(row).toBeTruthy();
    expect(row!.registeredSeats).toBe(1);
    expect(row!.totalCapacity).toBe(4);
    expect(row!.checkedIn).toBe(1);
    expect(row!.attendanceRate).toBe(100);
    expect(row!.occurrences).toBe(1);
  });

  it('builds an iCalendar feed with escaped event fields', async () => {
    const { event } = await makeEvent({ title: 'Gala, Saison; 2026' });
    const ics = await buildEventIcs(tenantId, event.id);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('SUMMARY:Gala\\, Saison\\; 2026');
    expect(ics).toContain('DTSTART:');
    expect(ics).toContain('BEGIN:VEVENT');
  });
});
