import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalManifest } from '@/libs/api/portal-manifest';

// GET /api/portal/manifest — returns navigation, quick actions, and widgets
// filtered by the authenticated user's permissions.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);

    // super_admin legitimately has no tenant and short-circuits every
    // capability check. Everyone else must have one: the manifest builder
    // falls back to '' when tenantId is null, and an empty tenant matches no
    // permission override, so the user would silently receive the role
    // defaults instead of being rejected.
    if (context.role !== 'super_admin') {
      requireTenant(context);
    }

    const manifest = await getPortalManifest(context);

    return NextResponse.json({ success: true, data: manifest });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
