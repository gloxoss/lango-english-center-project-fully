import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listTemplateVersions, addTemplateVersion } from '@/features/broadcast/services/templates-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const templateVersionSchema = z.object({
  subject: z.string().max(255).nullable().optional(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().nullable().optional(),
  variableSchema: z.array(z.object({ name: z.string().min(1) })).optional(),
  locale: z.string().max(10).optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const data = await listTemplateVersions(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { id } = await params;
    const body = await parseJson(request, templateVersionSchema);
    const data = await addTemplateVersion(tenantId, id, body, context.userId);
    recordAudit(context, 'create', 'broadcast.templateVersion', data.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
