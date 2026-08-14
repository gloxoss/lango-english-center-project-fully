import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const updateVehicleSchema = z.object({
  vehicleCode: z.string().min(1).optional(),
  registrationNumber: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  vehicleType: z.string().optional(),
  makeModel: z.string().optional().nullable(),
  ownershipVendor: z.string().optional().nullable(),
  externalGpsDeviceId: z.string().optional().nullable(),
  accessibilityAttributes: z.record(z.string(), z.any()).optional().nullable(),
  status: z.enum(['active', 'maintenance', 'out_of_service', 'retired']).optional(),
  insuranceExpiry: z.string().optional().nullable(),
  inspectionExpiry: z.string().optional().nullable(),
  permitExpiry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
    const vehicle = await TransportService.getVehicleById(tenantId, id);
    if (!vehicle) {
      throw new ApiError(404, 'NOT_FOUND', 'Véhicule introuvable.');
    }

    return NextResponse.json({ success: true, data: vehicle });
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
    await requireCapability(context, 'transport.vehicle.manage');

    const { id } = await params;
    const body = await parseJson(request, updateVehicleSchema);
    const updated = await TransportService.updateVehicle(tenantId, id, body);

    recordAudit(context, 'update', 'transport_vehicle', id, { changes: body });

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
    await requireCapability(context, 'transport.vehicle.manage');

    const { id } = await params;
    await TransportService.deleteVehicle(tenantId, id);

    recordAudit(context, 'delete', 'transport_vehicle', id, {});

    return NextResponse.json({ success: true, message: 'Véhicule supprimé.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
