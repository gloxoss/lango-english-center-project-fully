import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listAutomations, createAutomation } from '@/features/broadcast/services/automations-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const createAutomationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: z.string().trim().min(1).max(100),
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']),
  connectionId: z.string().uuid(),
  templateId: z.string().uuid(),
  timezone: z.string().max(100).optional(),
  sendTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  approvalMode: z.enum(['auto', 'manual']).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const data = await listAutomations(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.automations.manage');
    const body = await parseJson(request, createAutomationSchema);
    const data = await createAutomation(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.automation', data.id, { kind: data.kind });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
