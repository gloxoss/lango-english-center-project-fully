import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { cancelCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.send');
    const { id } = await params;
    const data = await cancelCampaign(tenantId, id);
    recordAudit(context, 'update', 'broadcast.campaign', data.id, { action: 'cancel' });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
