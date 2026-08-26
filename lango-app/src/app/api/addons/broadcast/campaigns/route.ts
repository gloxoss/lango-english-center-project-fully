import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listCampaigns, createCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(255),
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']),
  connectionId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  subject: z.string().max(255).nullable().optional(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().nullable().optional(),
  scheduleAt: z.string().nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  idempotencyKey: z.string().max(255).nullable().optional(),
}).strict();

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
    const body = await parseJson(request, createCampaignSchema);
    const data = await createCampaign(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.campaign', data.id, { channel: data.channel });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
