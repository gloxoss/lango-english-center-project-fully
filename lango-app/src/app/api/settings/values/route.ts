import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import {
  getAllEffectiveValues,
  getDefinition,
  getNamespaces,
  SETTINGS_REGISTRY,
  setSettingValue,
} from '@/libs/settings/registry';
import { requireCapability } from '@/libs/api/permissions';
import type { PermissionKey } from '@/libs/api/permissions';
import { getCatalogDefinitions } from '@/features/settings/services/definitions-service';

// GET /api/settings/values — all effective settings for this tenant/branch,
// plus DB-backed catalog metadata (label/description) for the values page.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const values = await getAllEffectiveValues(tenantId, context.branchId);

    // Group by namespace for the UI.
    const namespaces = getNamespaces();
    const grouped = Object.fromEntries(
      namespaces.map(ns => [
        ns,
        values.filter(v => {
          const def = SETTINGS_REGISTRY.find(d => d.key === v.key);
          return def?.namespace === ns;
        }),
      ]),
    );

    // Catalog metadata (DB-backed, label/description/scope/sensitivity) keyed
    // by setting key so the page can render proper labels and help text.
    const catalog = await getCatalogDefinitions(tenantId);
    const definitions = Object.fromEntries(
      catalog.map(d => [d.key, {
        label: d.label,
        description: d.description,
        namespace: d.namespace,
        scope: d.scope,
        sensitivity: d.sensitivity,
        legacyField: d.legacyField,
      }]),
    );

    return NextResponse.json({ success: true, data: { values, grouped, namespaces, definitions } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const batchUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1).max(128),
    value: z.unknown(),
    reason: z.string().max(500).optional(),
  })).min(1).max(50),
}).strict();

// POST /api/settings/values — batch update multiple settings.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, batchUpdateSchema);

    const results: { key: string; version: number }[] = [];

    for (const item of body.settings) {
      // Per-key capability check: each setting carries its own requiredPermission.
      // getDefinition() throws 400 for unknown keys.
      const def = getDefinition(item.key);
      await requireCapability(context, def.requiredPermission as PermissionKey);

      const version = await setSettingValue(
        tenantId,
        context.branchId,
        item.key,
        item.value,
        context,
        item.reason,
      );
      results.push({ key: item.key, version });
    }

    recordAudit(context, 'update', 'settings', tenantId, {
      keys: results.map(r => r.key),
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: `${results.length} paramètre(s) mis à jour.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
