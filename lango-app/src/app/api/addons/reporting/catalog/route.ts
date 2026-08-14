import { type NextRequest, NextResponse } from 'next/server';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { canAccessReport } from '@/addons/advanced-reporting/services/report-access';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const definitions = CatalogService.getDefinitions().filter(def => canAccessReport(context.role, def));
    return NextResponse.json({ success: true, data: definitions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
