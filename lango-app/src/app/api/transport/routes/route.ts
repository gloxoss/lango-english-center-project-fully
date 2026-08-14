import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const stopItemSchema = z.object({
  stopId: z.string().uuid(),
  plannedArrivalTime: z.string().optional().nullable(),
  plannedDepartureTime: z.string().optional().nullable(),
  dwellTimeSeconds: z.number().int().positive().default(60),
  pickupAllowed: z.boolean().default(true),
  dropoffAllowed: z.boolean().default(true),
}).strict();

const createRouteSchema = z.object({
  routeCode: z.string().min(1, 'Le code d\'itinéraire est requis.'),
  routeName: z.string().min(1, 'Le nom d\'itinéraire est requis.'),
  serviceDirection: z.enum(['pickup', 'dropoff', 'shuttle', 'bidirectional']).default('bidirectional'),
  assignedVehicleId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'active', 'suspended', 'archived']).default('active'),
  branchId: z.string().optional().nullable(),
  effectiveStartDate: z.string().optional().nullable(),
  distanceKm: z.number().optional().nullable(),
  durationMinutes: z.number().int().optional().nullable(),
  stops: z.array(stopItemSchema).optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.read');

    const url = new URL(request.url);
    const branchId = context.branchId || url.searchParams.get('branchId') || undefined;

    const routes = await TransportService.getRoutes(tenantId, branchId);
    return NextResponse.json({ success: true, data: routes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.route.manage');

    const body = await parseJson(request, createRouteSchema);
    const branchId = context.branchId || body.branchId || null;
    const route = await TransportService.createRoute(tenantId, { ...body, branchId });

    recordAudit(context, 'create', 'transport_route', route?.id || '', {
      routeCode: body.routeCode,
      routeName: body.routeName,
    });

    return NextResponse.json({ success: true, data: route }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
