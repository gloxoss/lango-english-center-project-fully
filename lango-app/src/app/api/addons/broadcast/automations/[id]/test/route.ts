import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { runAutomation } from '@/features/broadcast/services/automations-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const testAutomationSchema = z.object({
  runDate: z.string().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.automations.manage');
    const { id } = await params;
    const body = await parseJson(request, testAutomationSchema);
    const data = await runAutomation(tenantId, id, body.runDate ?? undefined);
    recordAudit(context, 'update', 'broadcast.automation', id, { action: 'run', runId: data.runId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
