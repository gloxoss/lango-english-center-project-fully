import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { redeemJoinGrant } from '@/features/live-classrooms/services/join-service';

const redeemSchema = z.object({ token: z.string().trim().min(1).max(2000) }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.join');

    const { id } = await params;
    const body = await parseJson(request, redeemSchema);
    const join = await redeemJoinGrant(context, tenantId, id, body.token);
    recordAudit(context, 'update', 'live_class_session', id, { action: 'join', role: join.role });
    return NextResponse.json({ success: true, data: join });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
