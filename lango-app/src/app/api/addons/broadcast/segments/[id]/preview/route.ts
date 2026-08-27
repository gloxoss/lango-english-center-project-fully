import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getSegment, computeSegment, parseSegmentDefinition, maskRecipientContacts } from '@/features/broadcast/services/segments-service';
import { parseJson } from '@/libs/api/validation';

const previewSegmentSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const body = await parseJson(request, previewSegmentSchema);
    const seg = await getSegment(tenantId, id);
    const result = await computeSegment(tenantId, parseSegmentDefinition(seg.definition), { limit: body.limit ?? 50 });
    // Preview runs behind broadcast.read; guardian phone/email must not leak.
    return NextResponse.json({ success: true, data: { ...result, recipients: maskRecipientContacts(result.recipients) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
