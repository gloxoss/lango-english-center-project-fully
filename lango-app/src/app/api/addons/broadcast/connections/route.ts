import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listConnections, createConnection } from '@/features/broadcast/services/connections-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const data = await listConnections(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.connections.manage');
    const body = await request.json();
    const data = await createConnection(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.connection', data.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
