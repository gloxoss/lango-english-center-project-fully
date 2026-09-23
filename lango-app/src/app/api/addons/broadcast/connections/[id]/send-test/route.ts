import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { sendTestMessage } from '@/features/broadcast/services/connections-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const sendTestSchema = z.object({
  to: z.string().min(3),
  message: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.connections.manage');
    const { id } = await params;
    const body = await parseJson(request, sendTestSchema);
    const result = await sendTestMessage(tenantId, id, body.to, body.message);
    recordAudit(context, 'create', 'broadcast.test_send', id, { to: body.to, ok: result.ok });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
