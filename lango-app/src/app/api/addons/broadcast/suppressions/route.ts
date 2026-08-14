import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listSuppressions, addSuppression } from '@/features/broadcast/services/consent-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const data = await listSuppressions(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await request.json();
    await addSuppression(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.suppression', `${body.recipientKind}:${body.recipientId}`, { channel: body.channel ?? null });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
