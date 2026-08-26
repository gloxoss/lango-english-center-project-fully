// Transport entitlement guard + capacity-aware allocation tests.
//
// Guard: `requireAddon(tenantId, 'transport')` is the shared gate behind every
// api/transport/** route. We prove the boundary deny/allow directly against a
// real DB, plus tenant isolation on the vehicle lookup, plus the capacity
// invariant that `allocateStudent` must never let a vehicle go over capacity.
//
// DB availability is probed with `checkDbReachable()` (NOT the old
// `Boolean(process.env.DATABASE_URL)` pattern — see subscription-enforcement
// test) so these suites skip cleanly instead of failing on a missing DB.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import { TransportService, calculateSegmentCapacity } from '@/features/transport/services/transport-service';
import {
  transportRouteStops,
  transportRoutes,
  transportRouteVersions,
  transportStops,
  transportStudentAllocations,
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

// ---------------------------------------------------------------------------
// Pure capacity math — no DB required, always runs.
// ---------------------------------------------------------------------------
describe('calculateSegmentCapacity (pure)', () => {
  it('allows occupancy at or below capacity', () => {
    expect(calculateSegmentCapacity(30, 30)).toMatchObject({ available: 0, maxAllowed: 30, isOverbooked: false });
    expect(calculateSegmentCapacity(30, 29)).toMatchObject({ available: 1, isOverbooked: false });
  });

  it('flags occupancy above capacity as overbooked', () => {
    expect(calculateSegmentCapacity(30, 31)).toMatchObject({ maxAllowed: 30, isOverbooked: true });
  });

  it('applies a margin percent to the maximum allowed', () => {
    expect(calculateSegmentCapacity(10, 11, 10)).toMatchObject({ maxAllowed: 11, isOverbooked: false });
    expect(calculateSegmentCapacity(10, 12, 10)).toMatchObject({ isOverbooked: true });
  });

  it('never reports negative availability', () => {
    expect(calculateSegmentCapacity(2, 5).available).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DB-backed guard + isolation + capacity tests.
// ---------------------------------------------------------------------------
const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('transport entitlement guard + capacity', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `TR-GUARD-ADMIN-${suffix}`;
  const studentA = `TR-GUARD-STU-A-${suffix}`;
  const studentB = `TR-GUARD-STU-B-${suffix}`;

  const today = new Date().toISOString().split('T')[0]!;

  let vehicleId = '';
  let stop1 = '';
  let stop2 = '';
  let routeId = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Transport Guard A ${suffix}`, slug: `tr-guard-a-${suffix}` },
      { id: tenantB, name: `Transport Guard B ${suffix}`, slug: `tr-guard-b-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Guard Admin', email: `tr-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Student A', email: `tr-guard-stu-a-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentB, tenantId: tenantA, name: 'Student B', email: `tr-guard-stu-b-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    vehicleId = (await db.insert(transportVehicles).values({
      tenantId: tenantA, vehicleCode: `TV-${suffix}`, registrationNumber: `REG-${suffix}`, capacity: 1, status: 'active',
    }).returning({ id: transportVehicles.id }))[0]!.id;

    stop1 = (await db.insert(transportStops).values({ tenantId: tenantA, stopCode: `S1-${suffix}`, stopName: 'Stop 1', status: 'active' }).returning({ id: transportStops.id }))[0]!.id;
    stop2 = (await db.insert(transportStops).values({ tenantId: tenantA, stopCode: `S2-${suffix}`, stopName: 'Stop 2', status: 'active' }).returning({ id: transportStops.id }))[0]!.id;

    routeId = (await db.insert(transportRoutes).values({
      tenantId: tenantA, routeCode: `TR-${suffix}`, routeName: 'Route', assignedVehicleId: vehicleId, status: 'active',
    }).returning({ id: transportRoutes.id }))[0]!.id;

    const versionId = (await db.insert(transportRouteVersions).values({
      tenantId: tenantA, routeId, versionNumber: 1, effectiveStartDate: today, status: 'published',
    }).returning({ id: transportRouteVersions.id }))[0]!.id;

    await db.insert(transportRouteStops).values([
      { tenantId: tenantA, versionId, stopId: stop1, stopSequence: 1, pickupAllowed: true, dropoffAllowed: true },
      { tenantId: tenantA, versionId, stopId: stop2, stopSequence: 2, pickupAllowed: true, dropoffAllowed: true },
    ]);

    await db.update(transportRoutes).set({ activeVersionId: versionId }).where(eq(transportRoutes.id, routeId));
  }, 30_000);

  afterAll(async () => {
    await db.delete(transportStudentAllocations).where(eq(transportStudentAllocations.tenantId, tenantA));
    await db.delete(transportRouteStops).where(eq(transportRouteStops.tenantId, tenantA));
    await db.delete(transportRouteVersions).where(eq(transportRouteVersions.tenantId, tenantA));
    await db.delete(transportRoutes).where(eq(transportRoutes.tenantId, tenantA));
    await db.delete(transportStops).where(eq(transportStops.tenantId, tenantA));
    await db.delete(transportVehicles).where(eq(transportVehicles.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  describe('entitlement guard', () => {
    it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
      await expect(requireAddon(tenantA, 'transport')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });

    it('allows once enabled, then denies again after being disabled', async () => {
      await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'transport', isEnabled: true });
      await expect(requireAddon(tenantA, 'transport')).resolves.toBeUndefined();

      await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantA));
      await expect(requireAddon(tenantA, 'transport')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });
  });

  describe('tenant isolation', () => {
    it('returns the vehicle for its own tenant and null for a foreign tenant', async () => {
      const own = await TransportService.getVehicleById(tenantA, vehicleId);
      const foreign = await TransportService.getVehicleById(tenantB, vehicleId);
      expect(own).not.toBeNull();
      expect(own!.id).toBe(vehicleId);
      expect(foreign).toBeNull();
    });
  });

  describe('capacity-aware allocation', () => {
    it('allows the first rider on a capacity-1 vehicle', async () => {
      const alloc = await TransportService.allocateStudent(tenantA, {
        studentId: studentA, routeId, pickupStopId: stop1, dropoffStopId: stop2, direction: 'morning', effectiveStartDate: today,
      });
      expect(alloc.status).toBe('active');
    });

    it('rejects a second rider on the same segment with CAPACITY_EXCEEDED', async () => {
      await expect(
        TransportService.allocateStudent(tenantA, {
          studentId: studentB, routeId, pickupStopId: stop1, dropoffStopId: stop2, direction: 'morning', effectiveStartDate: today,
        }),
      ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    });
  });
});
