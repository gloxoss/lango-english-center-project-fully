import { NextResponse } from 'next/server';
import { listAddonDefinitions } from '@/libs/api/addon-catalog';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { listSchoolsWithLicenses } from '@/features/subscriptions/services/subscription-service';

// GET /api/super-admin/subscriptions - every school with its license status,
// plus roll-up KPIs and the addon catalog (drives both super-admin pages).
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const [data, catalog] = await Promise.all([
      listSchoolsWithLicenses(),
      listAddonDefinitions(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        schools: data.schools,
        summary: data.summary,
        catalog: catalog.map(addon => ({
          addonId: addon.id,
          name: addon.name,
          description: addon.description,
          built: addon.enabled,
          requires: addon.requires ?? [],
        })),
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
