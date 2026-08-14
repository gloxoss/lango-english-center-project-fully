import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { scheduleCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.send');
    const { id } = await params;
    const body = await request.json();
    const data = await scheduleCampaign(tenantId, id, body.scheduleAt ?? null);
    recordAudit(context, 'update', 'broadcast.campaign', data.id, { action: 'schedule', scheduleAt: body.scheduleAt ?? null });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
