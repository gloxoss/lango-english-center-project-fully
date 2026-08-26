// Transport rider-scan integrity (adversarial) tests.
//
// `recordRiderEvent` is the boarding/alighting write path behind QR/NFC scans.
// These tests attack it: replaying a scan, reusing an idempotency key with a
// different payload, scanning a student who is not on the trip roster, scanning
// a student from another tenant, scanning at a stop not on the route, scanning
// against a trip that is not boarding, and alighting before boarding.
//
// DB availability is probed with `checkDbReachable()` (NOT the old
// `Boolean(process.env.DATABASE_URL)` pattern).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import { TransportService } from '@/features/transport/services/transport-service';
import {
  transportRiderEvents,
  transportRoutes,
  transportRouteStops,
  transportRouteVersions,
  transportStops,
  transportTripRosterSnapshots,
  transportTrips,
  transportVehicles,
} from '@/features/transport/models/transport-schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('transport rider-scan integrity', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `TR-RIDER-ADMIN-${suffix}`;
  const studentA = `TR-RIDER-STU-A-${suffix}`; // on roster
  const studentB = `TR-RIDER-STU-B-${suffix}`; // foreign tenant
  const studentC = `TR-RIDER-STU-C-${suffix}`; // same tenant, not on roster
  const studentD = `TR-RIDER-STU-D-${suffix}`; // same tenant, on roster but never boarded

  const today = new Date().toISOString().split('T')[0]!;

  let stop1 = '';
  let stop2 = '';
  let stop3 = ''; // same tenant but NOT part of the route version
  let routeId = '';
  let versionId = '';
  let tripBoarding = '';
  let tripScheduled = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Transport Rider A ${suffix}`, slug: `tr-rider-a-${suffix}` },
      { id: tenantB, name: `Transport Rider B ${suffix}`, slug: `tr-rider-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Rider Admin', email: `tr-rider-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Rider A', email: `tr-rider-a-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentB, tenantId: tenantB, name: 'Rider B', email: `tr-rider-b-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentC, tenantId: tenantA, name: 'Rider C', email: `tr-rider-c-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentD, tenantId: tenantA, name: 'Rider D', email: `tr-rider-d-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    const vehicleId = (await db.insert(transportVehicles).values({
      tenantId: tenantA, vehicleCode: `RTV-${suffix}`, registrationNumber: `RREG-${suffix}`, capacity: 30, status: 'active',
    }).returning({ id: transportVehicles.id }))[0]!.id;

    stop1 = (await db.insert(transportStops).values({ tenantId: tenantA, stopCode: `R1-${suffix}`, stopName: 'Stop 1', status: 'active' }).returning({ id: transportStops.id }))[0]!.id;
    stop2 = (await db.insert(transportStops).values({ tenantId: tenantA, stopCode: `R2-${suffix}`, stopName: 'Stop 2', status: 'active' }).returning({ id: transportStops.id }))[0]!.id;
    stop3 = (await db.insert(transportStops).values({ tenantId: tenantA, stopCode: `R3-${suffix}`, stopName: 'Stop 3 (off route)', status: 'active' }).returning({ id: transportStops.id }))[0]!.id;

    routeId = (await db.insert(transportRoutes).values({
      tenantId: tenantA, routeCode: `RR-${suffix}`, routeName: 'Rider Route', assignedVehicleId: vehicleId, status: 'active',
    }).returning({ id: transportRoutes.id }))[0]!.id;

    versionId = (await db.insert(transportRouteVersions).values({
      tenantId: tenantA, routeId, versionNumber: 1, effectiveStartDate: today, status: 'published',
    }).returning({ id: transportRouteVersions.id }))[0]!.id;

    await db.insert(transportRouteStops).values([
      { tenantId: tenantA, versionId, stopId: stop1, stopSequence: 1, pickupAllowed: true, dropoffAllowed: true },
      { tenantId: tenantA, versionId, stopId: stop2, stopSequence: 2, pickupAllowed: true, dropoffAllowed: true },
    ]);

    await db.update(transportRoutes).set({ activeVersionId: versionId }).where(eq(transportRoutes.id, routeId));

    tripBoarding = (await db.insert(transportTrips).values({
      tenantId: tenantA, routeId, routeVersionId: versionId, serviceDate: today, direction: 'pickup', vehicleId, status: 'boarding',
    }).returning({ id: transportTrips.id }))[0]!.id;

    tripScheduled = (await db.insert(transportTrips).values({
      tenantId: tenantA, routeId, routeVersionId: versionId, serviceDate: today, direction: 'dropoff', vehicleId, status: 'scheduled',
    }).returning({ id: transportTrips.id }))[0]!.id;

    await db.insert(transportTripRosterSnapshots).values([
      { tenantId: tenantA, tripId: tripBoarding, studentId: studentA, pickupStopId: stop1, dropoffStopId: stop2, direction: 'pickup', allocatedStatus: 'allocated' },
      { tenantId: tenantA, tripId: tripBoarding, studentId: studentD, pickupStopId: stop1, dropoffStopId: stop2, direction: 'pickup', allocatedStatus: 'allocated' },
    ]);
  }, 30_000);

  afterAll(async () => {
    await db.delete(transportRiderEvents).where(eq(transportRiderEvents.tenantId, tenantA));
    await db.delete(transportTripRosterSnapshots).where(eq(transportTripRosterSnapshots.tenantId, tenantA));
    await db.delete(transportTrips).where(eq(transportTrips.tenantId, tenantA));
    await db.delete(transportRouteStops).where(eq(transportRouteStops.tenantId, tenantA));
    await db.delete(transportRouteVersions).where(eq(transportRouteVersions.tenantId, tenantA));
    await db.delete(transportRoutes).where(eq(transportRoutes.tenantId, tenantA));
    await db.delete(transportStops).where(eq(transportStops.tenantId, tenantA));
    await db.delete(transportVehicles).where(eq(transportVehicles.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  it('records a boarding event for a rostered student', async () => {
    const event = await TransportService.recordRiderEvent(tenantA, {
      tripId: tripBoarding, studentId: studentA, stopId: stop1, eventType: 'boarded', actorUserId: adminA, verificationMethod: 'qr_scan',
    });
    expect(event.id).toBeTruthy();
    expect(event.eventType).toBe('boarded');
  });

  it('replays an idempotent scan without creating a duplicate event', async () => {
    const key = `IDEM-${suffix}-1`;
    const payload = { tripId: tripBoarding, studentId: studentA, stopId: stop2, eventType: 'boarded' as const, actorUserId: adminA, idempotencyKey: key };
    const first = await TransportService.recordRiderEvent(tenantA, payload);
    const replay = await TransportService.recordRiderEvent(tenantA, payload);
    expect(replay.id).toBe(first.id);

    const rows = await db.select().from(transportRiderEvents).where(eq(transportRiderEvents.idempotencyKey, key));
    expect(rows).toHaveLength(1);
  });

  it('rejects reusing an idempotency key with a different payload', async () => {
    const key = `IDEM-${suffix}-2`;
    await TransportService.recordRiderEvent(tenantA, {
      tripId: tripBoarding, studentId: studentA, stopId: stop1, eventType: 'boarded', actorUserId: adminA, idempotencyKey: key,
    });
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripBoarding, studentId: studentA, stopId: stop2, eventType: 'alighted', actorUserId: adminA, idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('rejects a student who is not on the trip roster', async () => {
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripBoarding, studentId: studentC, stopId: stop1, eventType: 'boarded', actorUserId: adminA,
      }),
    ).rejects.toMatchObject({ code: 'NOT_ON_ROSTER' });
  });

  it('rejects a student from another tenant (not on this trip roster)', async () => {
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripBoarding, studentId: studentB, stopId: stop1, eventType: 'boarded', actorUserId: adminA,
      }),
    ).rejects.toMatchObject({ code: 'NOT_ON_ROSTER' });
  });

  it('rejects a scan at a stop that is not part of the route', async () => {
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripBoarding, studentId: studentA, stopId: stop3, eventType: 'boarded', actorUserId: adminA,
      }),
    ).rejects.toMatchObject({ code: 'STOP_NOT_IN_ROUTE' });
  });

  it('rejects a scan against a trip that is not boarding/in-progress', async () => {
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripScheduled, studentId: studentA, stopId: stop1, eventType: 'boarded', actorUserId: adminA,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRIP_STATE' });
  });

  it('rejects alighting before boarding without an exception reason', async () => {
    await expect(
      TransportService.recordRiderEvent(tenantA, {
        tripId: tripBoarding, studentId: studentD, stopId: stop2, eventType: 'alighted', actorUserId: adminA,
      }),
    ).rejects.toMatchObject({ code: 'DROPOFF_BEFORE_BOARDING' });
  });
});
