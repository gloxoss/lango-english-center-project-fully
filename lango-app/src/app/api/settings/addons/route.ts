import { count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { listAddonDefinitions } from '@/libs/api/addon-catalog';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { listEntitlements } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { branches, tenants } from '@/models/Schema';

// GET /api/settings/addons - what THIS school has. Read-only by design:
// a school cannot grant itself a module, only super-admin can.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(ctx, 'settings.read');
    const tenantId = requireTenant(ctx);

    const [grants, [tenant], [branchCount], addons] = await Promise.all([
      listEntitlements(tenantId),
      db
        .select({
          planTier: tenants.planTier,
          subscriptionStatus: tenants.subscriptionStatus,
          maxBranches: tenants.maxBranches,
          hasMultiBranchAddon: tenants.hasMultiBranchAddon,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1),
      db
        .select({ value: count() })
        .from(branches)
        .where(eq(branches.tenantId, tenantId)),
      listAddonDefinitions(),
    ]);

    const byId = new Map(grants.map(g => [g.addonId, g]));
    const expiryInfo = (addonId: string): string | null => {
      if (!byId.get(addonId)?.active) return null;
      const expiry = byId.get(addonId)?.expiresAt;
      return expiry ? new Date(expiry).toLocaleDateString('fr-FR') : null;
    };

    return NextResponse.json({
      success: true,
      plan: {
        planTier: tenant?.planTier ?? 'trial',
        subscriptionStatus: tenant?.subscriptionStatus ?? 'active',
        maxBranches: tenant?.maxBranches ?? 1,
        hasMultiBranchAddon: tenant?.hasMultiBranchAddon ?? false,
        branchCount: branchCount?.value ?? 0,
      },
      data: addons.map(addon => ({
        addonId: addon.id,
        name: addon.name,
        description: addon.description,
        built: addon.enabled,
        active: byId.get(addon.id)?.active ?? false,
        expiresAt: byId.get(addon.id)?.expiresAt ?? null,
        expiryLabel: expiryInfo(addon.id),
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
