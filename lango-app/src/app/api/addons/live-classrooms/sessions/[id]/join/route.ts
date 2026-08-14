import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { issueJoinGrant } from '@/features/live-classrooms/services/join-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.join');

    const { id } = await params;
    const grant = await issueJoinGrant(context, tenantId, id);
    return NextResponse.json({ success: true, data: grant });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
