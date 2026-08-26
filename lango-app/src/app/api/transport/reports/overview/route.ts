import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  transportIncidents,
  transportRoutes,
  transportStudentAllocations,
  transportTrips,
  transportVehicles,
} from '@/features/transport/models/transport-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    // Basic module KPIs (vehicle/route/allocation/trip counts) for the
    // module's own landing dashboard - anyone who can land on /dashboard/
    // transport (transport.read: teacher, receptionist, guard...) should see
    // them. transport.report stays reserved for the actual deep-analytics
    // "Rapports & Exports" page.
    await requireCapability(context, 'transport.read');

    const todayStr: string = new Date().toISOString().split('T')[0]!;

    const [vehicleCount] = await db
      .select({ count: count() })
      .from(transportVehicles)
      .where(eq(transportVehicles.tenantId, tenantId));

    const [routeCount] = await db
      .select({ count: count() })
      .from(transportRoutes)
      .where(eq(transportRoutes.tenantId, tenantId));

    const [allocationCount] = await db
      .select({ count: count() })
      .from(transportStudentAllocations)
      .where(and(eq(transportStudentAllocations.tenantId, tenantId), eq(transportStudentAllocations.status, 'active')));

    const [todayTripCount] = await db
      .select({ count: count() })
      .from(transportTrips)
      .where(and(eq(transportTrips.tenantId, tenantId), eq(transportTrips.serviceDate, todayStr)));

    const [openIncidentCount] = await db
      .select({ count: count() })
      .from(transportIncidents)
      .where(and(eq(transportIncidents.tenantId, tenantId), eq(transportIncidents.status, 'open')));

    return NextResponse.json({
      success: true,
      data: {
        totalVehicles: Number(vehicleCount?.count || 0),
        totalRoutes: Number(routeCount?.count || 0),
        activeAllocations: Number(allocationCount?.count || 0),
        todayTrips: Number(todayTripCount?.count || 0),
        openIncidents: Number(openIncidentCount?.count || 0),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
