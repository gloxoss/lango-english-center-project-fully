import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { createLeavePass, listLeavePasses } from '@/features/hostel/services/leave-passes-service';
import { getCurrentStay } from '@/features/hostel/services/projections-service';

const createRequestSchema = z.object({
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
    if (context.role !== 'student') {
      throw new ApiError(403, 'FORBIDDEN', 'Réservé aux élèves.');
    }

    const data = await listLeavePasses(tenantId, { studentId: context.userId });
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
    if (context.role !== 'student') {
      throw new ApiError(403, 'FORBIDDEN', 'Réservé aux élèves.');
    }

    const body = await parseJson(request, createRequestSchema);
    const stay = await getCurrentStay(tenantId, context.userId);
    if (!stay) {
      throw new ApiError(409, 'NOT_ENROLLED', 'Aucune affectation active pour cet élève.');
    }

    const pass = await createLeavePass(tenantId, context.userId, {
      allocationId: stay.allocationId,
      destination: body.destination ?? null,
      reason: body.reason ?? null,
      startDateTime: body.startDateTime,
      expectedReturnAt: body.expectedReturnAt,
    });
    recordAudit(context, 'create', 'hostel_leave_pass', pass.id, { allocationId: stay.allocationId, selfService: true });
    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
