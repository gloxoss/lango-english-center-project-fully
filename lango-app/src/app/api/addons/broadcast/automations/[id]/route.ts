import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getAutomation, updateAutomation, deleteAutomation } from '@/features/broadcast/services/automations-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const updateAutomationSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  kind: z.string().trim().min(1).max(100).optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']).optional(),
  connectionId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  timezone: z.string().max(100).optional(),
  sendTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  approvalMode: z.enum(['auto', 'manual']).optional(),
  isActive: z.boolean().optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const data = await getAutomation(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.automations.manage');
    const { id } = await params;
    const body = await parseJson(request, updateAutomationSchema);
    const data = await updateAutomation(tenantId, id, body);
    recordAudit(context, 'update', 'broadcast.automation', data.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.automations.manage');
    const { id } = await params;
    await deleteAutomation(tenantId, id);
    recordAudit(context, 'delete', 'broadcast.automation', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
