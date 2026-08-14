import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getJoinSigningMode, isJoinSigningConfigured } from '@/features/live-classrooms/providers';

// Startup diagnostics for the add-on. Reports WHETHER the join-signing key is
// configured and its mode — never the value itself (P0-2 secrets policy).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.read');
    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        addon: 'live-classrooms',
        joinSigning: {
          configured: isJoinSigningConfigured(),
          mode: getJoinSigningMode(),
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
