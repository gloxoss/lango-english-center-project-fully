import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { acknowledgeEscalation } from '@/features/hostel/services/escalations-service';

const ackSchema = z.object({
  closureReason: z.string().max(2000).nullish(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.manage');

    const { id } = await params;
    const body = await parseJson(request, ackSchema);
    const escalation = await acknowledgeEscalation(tenantId, context.userId, id, body.closureReason ?? null);
    recordAudit(context, 'update', 'hostel_escalation', id, { acknowledged: true });
    return NextResponse.json({ success: true, data: escalation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
