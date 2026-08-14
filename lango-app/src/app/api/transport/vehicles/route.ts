import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const createVehicleSchema = z.object({
  vehicleCode: z.string().min(1, 'Le code véhicule est requis.'),
  registrationNumber: z.string().min(1, 'L\'immatriculation est requise.'),
  capacity: z.number().int().positive('La capacité doit être un nombre positif.'),
  vehicleType: z.string().default('bus'),
  makeModel: z.string().optional().nullable(),
  ownershipVendor: z.string().optional().nullable(),
  externalGpsDeviceId: z.string().optional().nullable(),
  accessibilityAttributes: z.record(z.string(), z.any()).optional().nullable(),
  status: z.enum(['active', 'maintenance', 'out_of_service', 'retired']).default('active'),
  insuranceExpiry: z.string().optional().nullable(),
  inspectionExpiry: z.string().optional().nullable(),
  permitExpiry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.read');

    const url = new URL(request.url);
    const branchId = context.branchId || url.searchParams.get('branchId') || undefined;

    const vehicles = await TransportService.getVehicles(tenantId, branchId);
    return NextResponse.json({ success: true, data: vehicles });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.vehicle.manage');

    const body = await parseJson(request, createVehicleSchema);
    const branchId = context.branchId || body.branchId || null;
    const vehicle = await TransportService.createVehicle(tenantId, { ...body, branchId });

    recordAudit(context, 'create', 'transport_vehicle', vehicle.id, {
      vehicleCode: vehicle.vehicleCode,
      registrationNumber: vehicle.registrationNumber,
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
