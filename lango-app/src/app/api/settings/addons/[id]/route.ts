import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertAddonDependencies, assertKnownAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { addonEntitlements } from '@/models/Schema';

const patchSchema = z.object({
  active: z.boolean(),
}).strict();

// PATCH /api/settings/addons/[id] — toggle an add-on for the current tenant.
// Only school_admin (users.permissions.manage) may do this.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: addonId } = await params;
    const ctx = await requireRequestContext(request, ['school_admin']);
    await requireCapability(ctx, 'users.permissions.manage');
    const tenantId = requireTenant(ctx);

    assertKnownAddon(addonId);

    const body = await parseJson(request, patchSchema);

    // A school_admin can only toggle existing grants (never grant new ones,
    // enforced below), but the dependency check applies to toggles too.
    await assertAddonDependencies(tenantId, addonId, body.active);

    // Upsert the entitlement row.
    const existing = await db
      .select({ id: addonEntitlements.id })
      .from(addonEntitlements)
      .where(and(
        eq(addonEntitlements.tenantId, tenantId),
        eq(addonEntitlements.addonId, addonId),
      ))
      .limit(1);

    if (existing[0]) {
      await db
        .update(addonEntitlements)
        .set({ isEnabled: body.active })
        .where(eq(addonEntitlements.id, existing[0].id));
    } else {
      // Only super_admin can grant a new entitlement; school_admin can only toggle existing ones.
      if (body.active) {
        throw new ApiError(403, 'FORBIDDEN', 'Un super-administrateur doit d\'abord activer ce module.');
      }
    }

    recordAudit(ctx, 'update', 'addon_entitlement', addonId, {
      tenantId,
      active: body.active,
    });

    return NextResponse.json({
      success: true,
      message: body.active
        ? `Module "${addonId}" activé.`
        : `Module "${addonId}" désactivé.`,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
