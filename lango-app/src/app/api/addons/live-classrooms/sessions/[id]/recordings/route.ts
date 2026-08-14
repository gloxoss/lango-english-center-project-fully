import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listSessionRecordings, syncSessionRecordings } from '@/features/live-classrooms/services/recording-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.recordings.read');

    const { id } = await params;
    const recordings = await listSessionRecordings(tenantId, id);
    return NextResponse.json({ success: true, data: recordings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.recordings.manage');

    const { id } = await params;
    const recordings = await syncSessionRecordings(context, tenantId, id);
    return NextResponse.json({ success: true, data: recordings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
