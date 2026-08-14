import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listDeliveryEvents } from '@/features/broadcast/services/deliveries-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const data = await listDeliveryEvents(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
