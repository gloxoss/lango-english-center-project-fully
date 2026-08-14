import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listCampaigns, createCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel') ?? undefined;
    const data = await listCampaigns(tenantId, channel);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await request.json();
    const data = await createCampaign(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.campaign', data.id, { channel: data.channel });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
