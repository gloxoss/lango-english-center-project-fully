import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import {
  getPortalPreferences,
  setPortalPreference,
} from '@/features/portal/services/portal-preferences';

const patchSchema = z
  .object({
    key: z.string().min(1).max(120),
    value: z.unknown(),
  })
  .strict();

// GET /api/portal/preferences — all keys for the actor in their tenant.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const preferences = await getPortalPreferences(tenantId, context.userId);
    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PATCH /api/portal/preferences — write one allowlisted, tenant+user scoped key.
export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, patchSchema);
    await setPortalPreference(tenantId, context.userId, body.key, body.value);
    const preferences = await getPortalPreferences(tenantId, context.userId);
    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
