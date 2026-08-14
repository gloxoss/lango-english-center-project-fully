import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { updateRoom } from '@/features/hostel/services/inventory-service';

const roomUpdateSchema = z.object({
  zoneId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().max(255).nullable().optional(),
  isAccessible: z.boolean().optional(),
  facilities: z.record(z.string(), z.unknown()).nullable().optional(),
  responsibleEmployeeId: z.uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'out_of_service', 'archived']).optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.manage');

    const { id } = await params;
    const body = await parseJson(request, roomUpdateSchema);
    const room = await updateRoom(tenantId, id, body);
    recordAudit(context, 'update', 'hostel_room', id, { code: room.code });
    return NextResponse.json({ success: true, data: room });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
