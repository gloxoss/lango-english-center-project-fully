import { NextResponse } from 'next/server';
import { ADDONS } from '@/addons/registry';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { listEntitlements } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';

// GET /api/settings/addons - what THIS school has. Read-only by design:
// a school cannot grant itself a module, only super-admin can.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const grants = await listEntitlements(tenantId);
    const byId = new Map(grants.map(g => [g.addonId, g]));

    return NextResponse.json({
      success: true,
      data: ADDONS.map(addon => ({
        addonId: addon.id,
        name: addon.name,
        description: addon.description,
        active: byId.get(addon.id)?.active ?? false,
        expiresAt: byId.get(addon.id)?.expiresAt ?? null,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
