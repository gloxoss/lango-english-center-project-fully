import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { getApplication, updateApplication } from '@/features/hostel/services/allocation-service';

const applicationUpdateSchema = z.object({
  guardianConsentStatus: z.enum(['not_required', 'required', 'approved', 'denied']).optional(),
  preferredCategoryIds: z.array(z.uuid()).max(20).nullable().optional(),
  preferredRoomId: z.uuid().nullable().optional(),
  priorityReason: z.string().max(2000).nullable().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(_request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.read');

    const { id } = await params;
    const application = await getApplication(tenantId, id);
    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const { id } = await params;
    const body = await parseJson(request, applicationUpdateSchema);
    const application = await updateApplication(tenantId, id, context.userId, body);
    recordAudit(context, 'update', 'hostel_application', id, { studentId: application.studentId });
    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
