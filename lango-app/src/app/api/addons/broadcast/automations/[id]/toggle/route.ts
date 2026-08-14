import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { toggleAutomation } from '@/features/broadcast/services/automations-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.automations.manage');
    const { id } = await params;
    const data = await toggleAutomation(tenantId, id);
    recordAudit(context, 'update', 'broadcast.automation', data.id, { action: 'toggle', isActive: data.isActive });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
