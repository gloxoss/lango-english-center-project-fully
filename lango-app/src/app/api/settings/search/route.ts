import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getEffectiveValue } from '@/libs/settings/registry';
import { getCatalogDefinitions } from '@/features/settings/services/definitions-service';

// GET /api/settings/search?q= — settings matching the query (key, label,
// namespace), with their current effective value. Used by the settings hub
// global search.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

    const defs = await getCatalogDefinitions(tenantId);
    const matches = defs
      .filter(d => !q
        || d.key.toLowerCase().includes(q)
        || d.label.toLowerCase().includes(q)
        || d.namespace.toLowerCase().includes(q)
        || (d.description ?? '').toLowerCase().includes(q))
      .slice(0, 50);

    const results = await Promise.all(
      matches.map(async (def) => {
        const effective = await getEffectiveValue(tenantId, context.branchId, def.key);
        return { ...def, effective };
      }),
    );

    return NextResponse.json({ success: true, data: { results, total: results.length } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
