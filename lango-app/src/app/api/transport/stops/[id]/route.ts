import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const updateStopSchema = z.object({
  stopCode: z.string().min(1).optional(),
  stopName: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
  landmark: z.string().optional().nullable(),
  safetyNotes: z.string().optional().nullable(),
  accessibilityNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  branchId: z.string().optional().nullable(),
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
    const stop = await TransportService.getStopById(tenantId, id);
    if (!stop) {
      throw new ApiError(404, 'NOT_FOUND', 'Arrêt introuvable.');
    }

    return NextResponse.json({ success: true, data: stop });
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
    const body = await parseJson(request, updateStopSchema);
    const updated = await TransportService.updateStop(tenantId, id, body);

    recordAudit(context, 'update', 'transport_stop', id, { changes: body });

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
    await TransportService.deleteStop(tenantId, id);

    recordAudit(context, 'delete', 'transport_stop', id, {});

    return NextResponse.json({ success: true, message: 'Arrêt supprimé.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
