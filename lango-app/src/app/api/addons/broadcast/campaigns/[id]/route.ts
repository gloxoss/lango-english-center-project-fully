import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getCampaign, updateCampaign, deleteCampaign } from '@/features/broadcast/services/campaigns-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']).optional(),
  connectionId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  subject: z.string().max(255).nullable().optional(),
  bodyText: z.string().min(1).optional(),
  bodyHtml: z.string().nullable().optional(),
  scheduleAt: z.string().nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  idempotencyKey: z.string().max(255).nullable().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const data = await getCampaign(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { id } = await params;
    const body = await parseJson(request, updateCampaignSchema);
    const data = await updateCampaign(tenantId, id, body);
    recordAudit(context, 'update', 'broadcast.campaign', data.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { id } = await params;
    await deleteCampaign(tenantId, id);
    recordAudit(context, 'delete', 'broadcast.campaign', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
