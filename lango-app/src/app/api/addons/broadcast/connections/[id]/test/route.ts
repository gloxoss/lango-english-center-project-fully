import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { testConnection } from '@/features/broadcast/services/connections-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.connections.manage');
    const { id } = await params;
    const result = await testConnection(tenantId, id);
    recordAudit(context, 'update', 'broadcast.connection', id, { action: 'test', ok: result.ok });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
