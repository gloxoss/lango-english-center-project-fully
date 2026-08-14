import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getCatalogDefinitions } from '@/features/settings/services/definitions-service';
import { db } from '@/libs/DB';
import { settingValues } from '@/models/Schema';

// GET /api/settings/readiness — per-namespace configuration status:
// how many keys are overridden vs default, whether secrets are set, and how
// many external integrations report connected. Powers the settings hub status
// cards without per-module ad-hoc queries.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const defs = await getCatalogDefinitions(tenantId);

    const rows = await db
      .select({ key: settingValues.key, value: settingValues.value })
      .from(settingValues)
      .where(and(
        eq(settingValues.tenantId, tenantId),
        isNull(settingValues.branchId),
      ));

    const overriddenKeys = new Set(rows.map(r => r.key));

    const namespaces = [...new Set(defs.map(d => d.namespace))];
    const modules = namespaces.map((ns) => {
      const nsDefs = defs.filter(d => d.namespace === ns);
      const overridden = nsDefs.filter(d => overriddenKeys.has(d.key));
      const secretSet = nsDefs.filter(d =>
        d.sensitivity === 'secret' && overriddenKeys.has(d.key));

      let integrationConnected = 0;
      if (ns === 'integrations') {
        const providersRow = rows.find(r => r.key === 'integrations.providers');
        const providers = Array.isArray(providersRow?.value) ? providersRow.value as unknown[] : [];
        integrationConnected = providers.filter(p =>
          (p as { status?: string }).status === 'operational').length;
      }

      return {
        namespace: ns,
        total: nsDefs.length,
        overridden: overridden.length,
        default: nsDefs.length - overridden.length,
        secretSet: secretSet.length,
        integrationConnected,
        configured: overridden.length > 0 || integrationConnected > 0,
      };
    });

    return NextResponse.json({ success: true, data: { modules } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
