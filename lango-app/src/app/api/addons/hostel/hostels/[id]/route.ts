import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { getHostel, updateHostel } from '@/features/hostel/services/inventory-service';

const hostelUpdateSchema = z.object({
  branchId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(255).optional(),
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(_request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const { id } = await params;
    const hostel = await getHostel(tenantId, id);
    return NextResponse.json({ success: true, data: hostel });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.manage');

    const { id } = await params;
    const body = await parseJson(request, hostelUpdateSchema);
    const hostel = await updateHostel(tenantId, id, body);

    recordAudit(context, 'update', 'hostel', id, { name: hostel.name });
    return NextResponse.json({ success: true, data: hostel });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
