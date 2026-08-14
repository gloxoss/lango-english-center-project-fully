import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { attachMaterial, listSessionMaterials } from '@/features/live-classrooms/services/recording-service';

const attachSchema = z.object({ assetId: z.string().uuid() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.read');

    const { id } = await params;
    const materials = await listSessionMaterials(tenantId, id);
    return NextResponse.json({ success: true, data: materials });
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
    const body = await parseJson(request, attachSchema);
    const material = await attachMaterial(context, tenantId, id, body.assetId);
    return NextResponse.json({ success: true, data: material }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
