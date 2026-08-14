import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listZones, createZone } from '@/features/hostel/services/inventory-service';

const zoneCreateSchema = z.object({
  hostelId: z.uuid(),
  parentZoneId: z.uuid().nullable().optional(),
  zoneType: z.enum(['building', 'floor', 'wing', 'zone']).optional(),
  code: z.string().max(50).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  curfewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM').nullable().optional(),
  rollCallTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM').nullable().optional(),
  visitorHours: z.record(z.string(), z.unknown()).nullable().optional(),
  emergencyAssemblyPoint: z.string().max(2000).nullable().optional(),
  chargePolicyOverride: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const url = new URL(request.url);
    const hostelId = url.searchParams.get('hostelId');
    const zones = await listZones(tenantId, hostelId);
    return NextResponse.json({ success: true, data: zones });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.manage');

    const body = await parseJson(request, zoneCreateSchema);
    const zone = await createZone(tenantId, body);
    recordAudit(context, 'create', 'hostel_zone', zone.id, { name: zone.name });
    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
