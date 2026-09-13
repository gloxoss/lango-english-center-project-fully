import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const createTripSchema = z.object({
  routeId: z.string().uuid('L\'itinéraire est requis.'),
  serviceDate: z.string().optional().nullable(),
  direction: z.enum(['pickup', 'dropoff', 'shuttle', 'bidirectional']).default('pickup'),
  plannedStartTime: z.string().optional().nullable(),
  plannedEndTime: z.string().optional().nullable(),
  scheduledDepartureTime: z.string().optional().nullable(),
  scheduledArrivalTime: z.string().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable().or(z.literal('')).transform(v => v || null),
  driverId: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
  attendantId: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
});

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.trip.read');

    const url = new URL(request.url);
    const date = url.searchParams.get('date') || url.searchParams.get('serviceDate') || undefined;
    const branchId = context.branchId || url.searchParams.get('branchId') || undefined;

    const rows = await TransportService.getTrips(tenantId, { date, branchId });
    const trips = rows.map((r: any) => ({
      ...r.trip,
      id: r.trip?.id,
      routeId: r.trip?.routeId,
      vehicleId: r.trip?.vehicleId,
      driverId: r.trip?.driverId,
      attendantId: r.trip?.attendantId,
      serviceDate: r.trip?.serviceDate,
      status: r.trip?.status,
      direction: r.trip?.direction,
      plannedStartTime: r.trip?.plannedStartTime,
      plannedEndTime: r.trip?.plannedEndTime,
      scheduledDepartureTime: r.trip?.plannedStartTime,
      scheduledArrivalTime: r.trip?.plannedEndTime,
      actualDepartureTime: r.trip?.actualStartTime,
      actualArrivalTime: r.trip?.actualEndTime,
      routeName: r.route?.routeName,
      routeCode: r.route?.routeCode,
      vehicleCode: r.vehicle?.vehicleCode,
      registrationNumber: r.vehicle?.registrationNumber,
      trip: r.trip,
      route: r.route,
      vehicle: r.vehicle,
    }));
    return NextResponse.json({ success: true, data: trips });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.trip.manage');

    const body = await parseJson(request, createTripSchema);
    const plannedStartTime = body.plannedStartTime || body.scheduledDepartureTime || null;
    const plannedEndTime = body.plannedEndTime || body.scheduledArrivalTime || null;
    const vehicleId = body.vehicleId || null;

    const trip = await TransportService.generateTrip(tenantId, {
      ...body,
      plannedStartTime,
      plannedEndTime,
      vehicleId,
    });

    recordAudit(context, 'create', 'transport_trip', trip.id, {
      routeId: body.routeId,
      serviceDate: trip.serviceDate,
      direction: trip.direction,
    });

    return NextResponse.json({ success: true, data: trip }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
