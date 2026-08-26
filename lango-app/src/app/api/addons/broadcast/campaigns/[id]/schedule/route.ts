import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { scheduleCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const scheduleCampaignSchema = z.object({
  scheduleAt: z.string().nullable().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.send');
    const { id } = await params;
    const body = await parseJson(request, scheduleCampaignSchema);
    const data = await scheduleCampaign(tenantId, id, body.scheduleAt ?? null);
    recordAudit(context, 'update', 'broadcast.campaign', data.id, { action: 'schedule', scheduleAt: body.scheduleAt ?? null });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
