import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { getConnection, updateConnection, deleteConnection, connectionPublic } from '@/features/broadcast/services/connections-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const updateConnectionSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const { id } = await params;
    // Project through the public shape: raw rows carry configJson with
    // (encrypted) secret keys that must never reach the browser.
    const data = connectionPublic(await getConnection(tenantId, id));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.connections.manage');
    const { id } = await params;
    const body = await parseJson(request, updateConnectionSchema);
    const data = await updateConnection(tenantId, id, body);
    recordAudit(context, 'update', 'broadcast.connection', data.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.connections.manage');
    const { id } = await params;
    await deleteConnection(tenantId, id);
    recordAudit(context, 'delete', 'broadcast.connection', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
