import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listTemplates, createTemplate } from '@/features/broadcast/services/templates-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel') ?? undefined;
    const data = await listTemplates(tenantId, channel);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await request.json();
    const data = await createTemplate(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.template', data.template.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
