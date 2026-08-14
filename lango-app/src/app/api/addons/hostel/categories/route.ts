import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listRoomCategories, createRoomCategory } from '@/features/hostel/services/inventory-service';

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(30),
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

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const categories = await listRoomCategories(tenantId);
    return NextResponse.json({ success: true, data: categories });
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

    const body = await parseJson(request, categoryCreateSchema);
    const category = await createRoomCategory(tenantId, body);
    recordAudit(context, 'create', 'hostel_room_category', category.id, { name: category.name, code: category.code });
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
