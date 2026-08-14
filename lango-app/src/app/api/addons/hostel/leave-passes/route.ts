import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { createLeavePass, listLeavePasses } from '@/features/hostel/services/leave-passes-service';

const createSchema = z.object({
  allocationId: z.string().uuid(),
  destination: z.string().max(255).nullish(),
  reason: z.string().max(2000).nullish(),
  startDateTime: z.string().datetime({ offset: true }),
  expectedReturnAt: z.string().datetime({ offset: true }),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.read');

    const { searchParams } = new URL(request.url);
    const data = await listLeavePasses(tenantId, {
      hostelId: searchParams.get('hostelId'),
      allocationId: searchParams.get('allocationId'),
      studentId: searchParams.get('studentId'),
      status: searchParams.get('status'),
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

    const body = await parseJson(request, createSchema);
    const pass = await createLeavePass(tenantId, context.userId, {
      allocationId: body.allocationId,
      destination: body.destination ?? null,
      reason: body.reason ?? null,
      startDateTime: body.startDateTime,
      expectedReturnAt: body.expectedReturnAt,
    });
    recordAudit(context, 'create', 'hostel_leave_pass', pass.id, { allocationId: body.allocationId });
    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
