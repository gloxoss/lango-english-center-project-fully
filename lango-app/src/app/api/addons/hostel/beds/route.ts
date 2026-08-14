import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listBeds, createBed } from '@/features/hostel/services/inventory-service';

const bedCreateSchema = z.object({
  roomId: z.uuid(),
  code: z.string().trim().min(1).max(50),
  isAccessible: z.boolean().optional(),
  status: z.enum(['active', 'out_of_service', 'archived']).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const url = new URL(request.url);
    const beds = await listBeds(tenantId, {
      roomId: url.searchParams.get('roomId') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });
    return NextResponse.json({ success: true, data: beds });
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

    const body = await parseJson(request, bedCreateSchema);
    const bed = await createBed(tenantId, body);
    recordAudit(context, 'create', 'hostel_bed', bed.id, { code: bed.code });
    return NextResponse.json({ success: true, data: bed }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
