import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const createStopSchema = z.object({
  stopCode: z.string().min(1, 'Le code d\'arrêt est requis.'),
  stopName: z.string().min(1, 'Le nom d\'arrêt est requis.'),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofenceRadiusMeters: z.number().int().positive().default(50),
  landmark: z.string().optional().nullable(),
  safetyNotes: z.string().optional().nullable(),
  accessibilityNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
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

    const stops = await TransportService.getStops(tenantId, branchId);
    return NextResponse.json({ success: true, data: stops });
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

    const body = await parseJson(request, createStopSchema);
    const branchId = context.branchId || body.branchId || null;
    const stop = await TransportService.createStop(tenantId, { ...body, branchId });

    recordAudit(context, 'create', 'transport_stop', stop.id, {
      stopCode: stop.stopCode,
      stopName: stop.stopName,
    });

    return NextResponse.json({ success: true, data: stop }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
