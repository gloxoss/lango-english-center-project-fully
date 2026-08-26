import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listConnections, createConnection } from '@/features/broadcast/services/connections-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const createConnectionSchema = z.object({
  channel: z.enum(['sms', 'email', 'whatsapp', 'telegram', 'messenger']),
  name: z.string().trim().min(1).max(255),
  provider: z.string().trim().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

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
    const body = await parseJson(request, createConnectionSchema);
    const data = await createConnection(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.connection', data.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
