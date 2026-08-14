import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { decideApplication } from '@/features/hostel/services/allocation-service';

const decisionSchema = z.object({
  decision: z.enum(['approved', 'denied', 'waitlisted', 'withdrawn']),
  decisionReason: z.string().max(2000).nullable().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const { id } = await params;
    const body = await parseJson(request, decisionSchema);
    const application = await decideApplication(tenantId, id, context.userId, body);
    recordAudit(context, 'update', 'hostel_application', id, {
      decision: application.decision,
      reason: body.decisionReason ?? null,
    });
    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
