import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { setBedStatus } from '@/features/hostel/services/inventory-service';

const statusSchema = z.object({
  status: z.enum(['active', 'out_of_service', 'archived']),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.manage');

    const { id } = await params;
    const body = await parseJson(request, statusSchema);
    const bed = await setBedStatus(tenantId, id, body.status, context.userId);
    recordAudit(context, 'update', 'hostel_bed', id, { status: bed.status });
    return NextResponse.json({ success: true, data: bed });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
