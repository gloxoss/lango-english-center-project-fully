import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listRooms, createRoom } from '@/features/hostel/services/inventory-service';

const roomCreateSchema = z.object({
  hostelId: z.uuid(),
  zoneId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().max(255).nullable().optional(),
  isAccessible: z.boolean().optional(),
  facilities: z.record(z.string(), z.unknown()).nullable().optional(),
  responsibleEmployeeId: z.uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'out_of_service', 'archived']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const url = new URL(request.url);
    const rooms = await listRooms(tenantId, {
      hostelId: url.searchParams.get('hostelId') ?? undefined,
      zoneId: url.searchParams.get('zoneId') ?? undefined,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
    });
    return NextResponse.json({ success: true, data: rooms });
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

    const body = await parseJson(request, roomCreateSchema);
    const room = await createRoom(tenantId, body);
    recordAudit(context, 'create', 'hostel_room', room.id, { code: room.code });
    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
