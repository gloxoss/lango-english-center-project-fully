import { db } from '../src/libs/DB';
import { eq } from 'drizzle-orm';
import {
  events, eventSchedules, eventOccurrences, eventVenues,
  eventRegistrations, eventWaitlistEntries,
} from '../src/features/events/models/events-schema';
import { registerForEvent } from '../src/features/events/services/events-service';

async function main() {
  const tenantId = 'TENANT-RACE-TEST';
  const person1 = 'user-1';
  const person2 = 'user-2';

  try {
    // 1. Create a dummy event with 1 seat
    console.log('Creating event...');
    const [event] = await db.insert(events).values({
      tenantId,
      ownerId: 'sys',
      title: 'Race Test Event',
      visibility: 'public',
      timezone: 'UTC',
      lifecycle: 'published',
    }).returning();
    if (!event) throw new Error('failed to insert event');

    const [schedule] = await db.insert(eventSchedules).values({
      tenantId,
      eventId: event.id,
      startTime: '2026-08-10T10:00:00Z',
      endTime: '2026-08-10T11:00:00Z',
      isAllDay: false,
      timezone: 'UTC',
    }).returning();
    if (!schedule) throw new Error('failed to insert schedule');

    const [occurrence] = await db.insert(eventOccurrences).values({
      tenantId,
      eventId: event.id,
      scheduleId: schedule.id,
      originalDate: '2026-08-10',
      startTime: '2026-08-10T10:00:00Z',
      endTime: '2026-08-10T11:00:00Z',
    }).returning();
    if (!occurrence) throw new Error('failed to insert occurrence');

    await db.insert(eventVenues).values({
      tenantId,
      eventId: event.id,
      venueType: 'physical',
      capacity: 1, // Only 1 seat
    });

    console.log(`Event created. Firing 2 concurrent registrations for 1 seat...`);

    // 2. Fire concurrent registrations
    const results = await Promise.allSettled([
      registerForEvent(tenantId, occurrence.id, person1, 1),
      registerForEvent(tenantId, occurrence.id, person2, 1),
    ]);

    console.log('Results:');
    let successCount = 0;
    let waitlistCount = 0;
    let errorCount = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r?.status === 'fulfilled') {
        console.log(`Req ${i + 1}: ${r.value.status}`);
        if (r.value.status === 'waitlisted') waitlistCount++;
        if (r.value.status === 'registered') successCount++;
      } else {
        console.error(`Req ${i + 1} ERROR:`, r?.reason);
        errorCount++;
      }
    }

    console.log(`\nFinal tally: ${successCount} registered, ${waitlistCount} waitlisted, ${errorCount} errors.`);
    if (successCount === 1 && waitlistCount === 1) {
      console.log('✅ TEST PASSED: Exactly 1 succeeded, 1 waitlisted.');
    } else {
      console.log('❌ TEST FAILED: Concurrency bug present.');
    }
  } finally {
    console.log('Cleaning up...');
    await db.delete(eventRegistrations).where(eq(eventRegistrations.tenantId, tenantId));
    await db.delete(eventWaitlistEntries).where(eq(eventWaitlistEntries.tenantId, tenantId));
    await db.delete(eventOccurrences).where(eq(eventOccurrences.tenantId, tenantId));
    await db.delete(eventSchedules).where(eq(eventSchedules.tenantId, tenantId));
    await db.delete(eventVenues).where(eq(eventVenues.tenantId, tenantId));
    await db.delete(events).where(eq(events.tenantId, tenantId));
  }
}

main().catch(console.error).finally(() => process.exit(0));
