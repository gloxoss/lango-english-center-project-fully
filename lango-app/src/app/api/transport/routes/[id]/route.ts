import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';
import { db } from '@/libs/DB';
import { transportRoutes, transportTrips } from '@/features/transport/models/transport-schema';
import { and, eq } from 'drizzle-orm';

const updateRouteSchema = z.object({
  routeName: z.string().min(1).optional(),
  serviceDirection: z.enum(['pickup', 'dropoff', 'shuttle', 'bidirectional']).optional(),
  assignedVehicleId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'active', 'suspended', 'archived']).optional(),
}).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.read');

    const { id } = await params;
    const route = await TransportService.getRouteById(tenantId, id);
    if (!route) {
      throw new ApiError(404, 'NOT_FOUND', 'Itinéraire introuvable.');
    }

    return NextResponse.json({ success: true, data: route });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.route.manage');

    const { id } = await params;
    const body = await parseJson(request, updateRouteSchema);

    const existing = await TransportService.getRouteById(tenantId, id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Itinéraire introuvable.');
    }

    const [updated] = await db
      .update(transportRoutes)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transportRoutes.id, id), eq(transportRoutes.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'transport_route', id, { changes: body });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.route.manage');

    const { id } = await params;
    const existing = await TransportService.getRouteById(tenantId, id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Itinéraire introuvable.');
    }

    const [inUseTrip] = await db
      .select({ id: transportTrips.id })
      .from(transportTrips)
      .where(and(eq(transportTrips.tenantId, tenantId), eq(transportTrips.routeId, id)))
      .limit(1);

    if (inUseTrip) {
      throw new ApiError(409, 'IN_USE', 'Cet itinéraire est associé à des trajets et ne peut pas être supprimé.');
    }

    await db
      .delete(transportRoutes)
      .where(and(eq(transportRoutes.id, id), eq(transportRoutes.tenantId, tenantId)));

    recordAudit(context, 'delete', 'transport_route', id, {});

    return NextResponse.json({ success: true, message: 'Itinéraire supprimé.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
