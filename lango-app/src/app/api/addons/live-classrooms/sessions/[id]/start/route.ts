import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { startLiveSession } from '@/features/live-classrooms/services/session-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.host');

    const { id } = await params;
    const session = await startLiveSession(context, tenantId, id);
    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
