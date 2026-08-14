import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getCampaign, computeRecipientPreview } from '@/features/broadcast/services/campaigns-service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const campaign = await getCampaign(tenantId, id);
    const totals = await computeRecipientPreview(tenantId, campaign);
    return NextResponse.json({ success: true, data: totals });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
