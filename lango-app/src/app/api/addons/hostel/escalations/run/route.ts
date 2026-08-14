import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { runEscalations } from '@/features/hostel/services/escalations-service';

const runSchema = z.object({
  triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.manage');

    const body = await parseJson(request, runSchema);
    const result = await runEscalations(tenantId, context.userId, { triggerDate: body.triggerDate });
    recordAudit(context, 'update', 'hostel_escalations', tenantId, result);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
