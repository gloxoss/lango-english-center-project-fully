import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalManifest } from '@/libs/api/portal-manifest';
import { listAvailableRoles } from '@/features/portal/services/active-context';

// GET /api/portal/manifest — returns navigation, quick actions, and widgets
// filtered by the authenticated user's effective permissions, plus the
// server-derived set of roles the actor may switch into.
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

    const [manifest, availableRoles] = await Promise.all([
      getPortalManifest(context),
      listAvailableRoles(context.tenantId, context.baseRole, context.userId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...manifest,
        baseRole: context.baseRole,
        availableRoles,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
