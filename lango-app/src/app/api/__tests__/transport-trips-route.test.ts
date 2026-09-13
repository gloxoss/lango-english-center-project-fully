import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/transport/trips/route';
import { db } from '@/libs/DB';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import { transportRoutes, transportRouteVersions, transportVehicles, transportTrips } from '@/features/transport/models/transport-schema';
import type { RequestContext } from '@/libs/api/context';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const ADMIN_ID = `USR-A-${crypto.randomUUID()}`;
const routeId = crypto.randomUUID();
const routeVersionId = crypto.randomUUID();
const vehicleId = crypto.randomUUID();
const tripId = crypto.randomUUID();
const testDate = '2026-09-15';

async function setContext(value: RequestContext) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue(value);
}

describe.skipIf(!dbReachable)('GET & POST /api/transport/trips', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Trips Test', slug: `trp-${tenantId}` });
    await db.insert(user).values([
      { id: ADMIN_ID, tenantId, name: 'Admin Test', email: `ad-${tenantId}@test.local`, role: 'school_admin' },
    ]);
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'transport', isEnabled: true });

    await db.insert(transportVehicles).values({
      id: vehicleId,
      tenantId,
      vehicleCode: 'BUS-TEST-99',
      registrationNumber: '9999-B-11',
      capacity: 30,
      status: 'active',
    });

    await db.insert(transportRoutes).values({
      id: routeId,
      tenantId,
      routeCode: 'RT-TRIP-TEST',
      routeName: 'Test Route for Trips',
      assignedVehicleId: vehicleId,
      activeVersionId: routeVersionId,
      status: 'active',
    });

    await db.insert(transportRouteVersions).values({
      id: routeVersionId,
      tenantId,
      routeId,
      versionNumber: 1,
      effectiveStartDate: '2026-01-01',
      status: 'published',
    });

    await db.insert(transportTrips).values({
      id: tripId,
      tenantId,
      routeId,
      routeVersionId,
      vehicleId,
      serviceDate: testDate,
      direction: 'pickup',
      plannedStartTime: '07:45',
      plannedEndTime: '08:30',
      status: 'scheduled',
    });

    await setContext({
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin Test',
      email: `ad-${tenantId}@test.local`,
    } as RequestContext);
  });

  afterAll(async () => {
    await db.delete(transportTrips).where(eq(transportTrips.tenantId, tenantId));
    await db.delete(transportRouteVersions).where(eq(transportRouteVersions.tenantId, tenantId));
    await db.delete(transportRoutes).where(eq(transportRoutes.tenantId, tenantId));
    await db.delete(transportVehicles).where(eq(transportVehicles.tenantId, tenantId));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('GET returns normalized trip objects with top-level id and route info', async () => {
    const res = await GET(new Request(`http://localhost/api/transport/trips?date=${testDate}`));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);

    const target = json.data.find((t: any) => t.id === tripId);
    expect(target).toBeDefined();
    expect(target.id).toBe(tripId);
    expect(target.status).toBe('scheduled');
    expect(target.plannedStartTime).toBe('07:45');
    expect(target.scheduledDepartureTime).toBe('07:45');
    expect(target.routeName).toBe('Test Route for Trips');
    expect(target.vehicleCode).toBe('BUS-TEST-99');
    // Also ensures nested access works for backward compatibility
    expect(target.trip?.id).toBe(tripId);
    expect(target.route?.routeName).toBe('Test Route for Trips');
    expect(target.vehicle?.vehicleCode).toBe('BUS-TEST-99');
  });

  it('GET resolves queries using serviceDate param synonymously', async () => {
    const res = await GET(new Request(`http://localhost/api/transport/trips?serviceDate=${testDate}`));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    const target = json.data.find((t: any) => t.id === tripId);
    expect(target).toBeDefined();
    expect(target.id).toBe(tripId);
  });

  it('POST creates a trip with scheduledDepartureTime and empty vehicleId transformed to null', async () => {
    const nextDate = '2026-09-16';
    const body = {
      routeId,
      serviceDate: nextDate,
      direction: 'pickup',
      scheduledDepartureTime: '08:00',
      scheduledArrivalTime: '08:45',
      vehicleId: '',
      driverId: '',
      attendantId: '',
    };

    const res = await POST(
      new Request('http://localhost/api/transport/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.routeId).toBe(routeId);
    expect(json.data.serviceDate).toBe(nextDate);
    expect(json.data.plannedStartTime).toBe('08:00');
  });
});
