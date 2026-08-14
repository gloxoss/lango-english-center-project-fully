import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listHostels, createHostel } from '@/features/hostel/services/inventory-service';

const hostelCreateSchema = z.object({
  branchId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  address: z.string().max(2000).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.email().max(255).nullable().optional(),
  genderPolicy: z.enum(['mixed', 'male_only', 'female_only']).optional(),
  ageMin: z.number().int().min(0).nullable().optional(),
  ageMax: z.number().int().min(0).nullable().optional(),
  policySnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  wardenEmployeeId: z.uuid().nullable().optional(),
  emergencyContactName: z.string().max(255).nullable().optional(),
  emergencyContactPhone: z.string().max(50).nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const hostels = await listHostels(tenantId, context.branchId);

    return NextResponse.json({ success: true, data: hostels });
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

    const body = await parseJson(request, hostelCreateSchema);
    const hostel = await createHostel(tenantId, body);

    recordAudit(context, 'create', 'hostel', hostel.id, { code: hostel.code, name: hostel.name });
    return NextResponse.json({ success: true, data: hostel }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
