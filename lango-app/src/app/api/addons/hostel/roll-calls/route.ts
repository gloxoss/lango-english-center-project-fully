import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { dateString } from '@/features/hostel/services/inventory-service';
import { listRollCalls, openRollCall } from '@/features/hostel/services/roll-call-service';

const openSchema = z.object({
  hostelId: z.string().uuid(),
  callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.read');

    const { searchParams } = new URL(request.url);
    const data = await listRollCalls(tenantId, {
      hostelId: searchParams.get('hostelId'),
      callDate: searchParams.get('callDate'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.manage');

    const body = await parseJson(request, openSchema);
    const rollCall = await openRollCall(tenantId, context.userId, {
      hostelId: body.hostelId,
      callDate: body.callDate ?? dateString(),
    });
    recordAudit(context, 'create', 'hostel_roll_call', rollCall.id,
      { hostelId: body.hostelId, callDate: rollCall.callDate });
    return NextResponse.json({ success: true, data: rollCall });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
