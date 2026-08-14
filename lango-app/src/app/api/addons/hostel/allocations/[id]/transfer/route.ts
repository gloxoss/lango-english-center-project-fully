import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { transferAllocation } from '@/features/hostel/services/allocation-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ');

const transferSchema = z.object({
  targetBedId: z.uuid(),
  effectiveDate: isoDate,
  reason: z.string().max(2000).nullable().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const { id } = await params;
    const body = await parseJson(request, transferSchema);
    const result = await transferAllocation(tenantId, context.userId, id, body);
    recordAudit(context, 'update', 'hostel_allocation', id, {
      action: 'transfer',
      targetBedId: body.targetBedId,
      effectiveDate: body.effectiveDate,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
