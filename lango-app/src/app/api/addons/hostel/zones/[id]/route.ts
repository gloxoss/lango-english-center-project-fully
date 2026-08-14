import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { updateZone } from '@/features/hostel/services/inventory-service';

const zoneUpdateSchema = z.object({
  parentZoneId: z.uuid().nullable().optional(),
  zoneType: z.enum(['building', 'floor', 'wing', 'zone']).optional(),
  code: z.string().max(50).nullable().optional(),
  name: z.string().trim().min(1).max(255).optional(),
  curfewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM').nullable().optional(),
  rollCallTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM').nullable().optional(),
  visitorHours: z.record(z.string(), z.unknown()).nullable().optional(),
  emergencyAssemblyPoint: z.string().max(2000).nullable().optional(),
  chargePolicyOverride: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.manage');

    const { id } = await params;
    const body = await parseJson(request, zoneUpdateSchema);
    const zone = await updateZone(tenantId, id, body);
    recordAudit(context, 'update', 'hostel_zone', id, { name: zone.name });
    return NextResponse.json({ success: true, data: zone });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
