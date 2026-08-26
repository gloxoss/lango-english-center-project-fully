import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listTemplates, createTemplate } from '@/features/broadcast/services/templates-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

export const templateVersionInputSchema = z.object({
  subject: z.string().max(255).nullable().optional(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().nullable().optional(),
  variableSchema: z.array(z.object({ name: z.string().min(1) })).optional(),
  locale: z.string().max(10).optional(),
}).strict();

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']),
  category: z.string().max(50).optional(),
  initial: templateVersionInputSchema,
}).strict();

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
    const body = await parseJson(request, createTemplateSchema);
    const data = await createTemplate(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.template', data.template.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
