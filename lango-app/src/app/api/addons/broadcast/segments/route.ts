import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { listSegments, createSegment, searchRecipients } from '@/features/broadcast/services/segments-service';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const data = await listSegments(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.manage');
    const body = await request.json();
    const data = await createSegment(tenantId, body, context.userId);
    recordAudit(context, 'create', 'broadcast.segment', data.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = await broadcastGuard(request, 'broadcast.read');
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const kind = url.searchParams.get('kind') ?? 'inquiry';
    const data = await searchRecipients(tenantId, kind as any, q);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
