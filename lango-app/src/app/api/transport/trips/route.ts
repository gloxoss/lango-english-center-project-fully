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
  vehicleId: z.string().uuid().optional().nullable(),
  driverId: z.string().optional().nullable(),
  attendantId: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.trip.read');

    const url = new URL(request.url);
    const date = url.searchParams.get('date') || undefined;
    const branchId = context.branchId || url.searchParams.get('branchId') || undefined;

    const trips = await TransportService.getTrips(tenantId, { date, branchId });
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
    const trip = await TransportService.generateTrip(tenantId, body);

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
