import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getSegment, computeSegment, parseSegmentDefinition } from '@/features/broadcast/services/segments-service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const seg = await getSegment(tenantId, id);
    const result = await computeSegment(tenantId, parseSegmentDefinition(seg.definition), { limit: body.limit ?? 50 });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
