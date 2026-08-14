import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { publishTemplateVersion } from '@/features/broadcast/services/templates-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { id, versionId } = await params;
    const data = await publishTemplateVersion(tenantId, id, versionId);
    recordAudit(context, 'update', 'broadcast.templateVersion', data.id, { action: 'publish' });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
