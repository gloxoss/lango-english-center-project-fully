import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { updateRoomCategory } from '@/features/hostel/services/inventory-service';

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).optional(),
  defaultCapacity: z.number().int().positive().nullable().optional(),
  amenities: z.record(z.string(), z.unknown()).nullable().optional(),
  eligibleGenderPolicy: z.enum(['mixed', 'male_only', 'female_only']).optional(),
  eligibleCohortIds: z.array(z.uuid()).max(500).nullable().optional(),
  baseCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Montant invalide').optional(),
  depositAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Montant invalide').optional(),
  priority: z.number().int().optional(),
  isAccessible: z.boolean().optional(),
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
    const body = await parseJson(request, categoryUpdateSchema);
    const category = await updateRoomCategory(tenantId, id, body);
    recordAudit(context, 'update', 'hostel_room_category', id, { name: category.name });
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
