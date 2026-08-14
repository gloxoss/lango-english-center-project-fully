import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listConsents, setConsent } from '@/features/broadcast/services/consent-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const data = await listConsents(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await request.json();
    await setConsent(tenantId, body);
    recordAudit(context, 'update', 'broadcast.consent', `${body.recipientKind}:${body.recipientId}`, { channel: body.channel, granted: body.granted });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
