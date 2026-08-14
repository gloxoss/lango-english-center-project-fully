import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getEffectiveValue } from '@/libs/settings/registry';
import { getCatalogDefinitions } from '@/features/settings/services/definitions-service';

// GET /api/settings/catalog — every setting definition (DB-backed metadata)
// with its current effective value, grouped by namespace. Powers the settings
// hub and the values page.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const defs = await getCatalogDefinitions(tenantId);

    const enriched = await Promise.all(
      defs.map(async (def) => {
        const effective = await getEffectiveValue(tenantId, context.branchId, def.key);
        return { ...def, effective };
      }),
    );

    const namespaces = [...new Set(enriched.map(d => d.namespace))];
    const grouped = Object.fromEntries(
      namespaces.map(ns => [ns, enriched.filter(d => d.namespace === ns)]),
    );

    return NextResponse.json({ success: true, data: { definitions: enriched, grouped, namespaces } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
