import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getAutomation, updateAutomation, deleteAutomation } from '@/features/broadcast/services/automations-service';
import { recordAudit } from '@/libs/api/audit';

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
    const body = await request.json();
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
