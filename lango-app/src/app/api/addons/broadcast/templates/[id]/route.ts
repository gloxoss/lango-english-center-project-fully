import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getTemplate, deleteTemplate } from '@/features/broadcast/services/templates-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    const data = await getTemplate(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const { id } = await params;
    await deleteTemplate(tenantId, id);
    recordAudit(context, 'delete', 'broadcast.template', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
