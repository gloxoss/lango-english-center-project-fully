import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { approveCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.send');
    const { id } = await params;
    const data = await approveCampaign(tenantId, id, context.userId);
    recordAudit(context, 'update', 'broadcast.campaign', data.campaign.id, { action: 'approve', status: data.campaign.status });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
