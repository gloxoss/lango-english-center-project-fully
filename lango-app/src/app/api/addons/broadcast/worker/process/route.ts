import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { processBroadcastQueue } from '@/features/broadcast/services/outbox-worker';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const processWorkerSchema = z.object({
  batch: z.number().int().min(1).max(1000).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await parseJson(request, processWorkerSchema);
    const data = await processBroadcastQueue(tenantId, { batch: Number(body.batch ?? 50) });
    if (data.claimedDeliveries > 0 || data.automationSent > 0 || data.automationFailed > 0) {
      recordAudit(context, 'update', 'broadcast.worker', 'queue', { summary: data });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
