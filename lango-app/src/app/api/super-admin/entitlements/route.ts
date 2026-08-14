import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADDONS } from '@/addons/registry';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { assertAddonDependencies, assertKnownAddon } from '@/libs/api/entitlements';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { addonEntitlements, tenants } from '@/models/Schema';

const upsertSchema = z.object({
  tenantId: z.uuid(),
  addonId: z.string().trim().min(1).max(64),
  isEnabled: z.boolean().optional(),
  // Date-only from the UI; null clears the expiry (perpetual grant).
  expiresAt: z.iso.date().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
}).strict();

const revokeSchema = z.object({
  tenantId: z.uuid(),
  addonId: z.string().trim().min(1).max(64),
}).strict();

async function assertTenantExists(tenantId: string): Promise<void> {
  const [row] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');
  }
}

// GET /api/super-admin/entitlements?tenantId=...
// Returns the full addon catalog joined with this tenant's grants, so the UI
// renders every module (granted or not) as one checklist.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const tenantId = new URL(request.url).searchParams.get('tenantId');
    if (!tenantId) {
      throw new ApiError(400, 'TENANT_ID_REQUIRED', 'Le paramètre tenantId est requis.');
    }
    await assertTenantExists(tenantId);

    const grants = await db
      .select()
      .from(addonEntitlements)
      .where(eq(addonEntitlements.tenantId, tenantId));

    const byId = new Map(grants.map(g => [g.addonId, g]));

    return NextResponse.json({
      success: true,
      data: ADDONS.map((addon) => {
        const grant = byId.get(addon.id);
        return {
          addonId: addon.id,
          name: addon.name,
          description: addon.description,
          granted: Boolean(grant),
          isEnabled: grant?.isEnabled ?? false,
          expiresAt: grant?.expiresAt ?? null,
          note: grant?.note ?? null,
        };
      }),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// POST grants or updates one addon for one tenant (idempotent upsert).
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const body = await parseJson(request, upsertSchema);
    assertKnownAddon(body.addonId);
    await assertTenantExists(body.tenantId);

    // Enforce add-on dependencies (e.g. payroll-workforce → human-resources).
    await assertAddonDependencies(body.tenantId, body.addonId, body.isEnabled ?? true);

    const values = {
      tenantId: body.tenantId,
      addonId: body.addonId,
      isEnabled: body.isEnabled ?? true,
      expiresAt: body.expiresAt ?? null,
      note: body.note ?? null,
      grantedById: ctx.userId,
      updatedAt: new Date().toISOString(),
    };

    const [row] = await db
      .insert(addonEntitlements)
      .values(values)
      .onConflictDoUpdate({
        target: [addonEntitlements.tenantId, addonEntitlements.addonId],
        set: {
          isEnabled: values.isEnabled,
          expiresAt: values.expiresAt,
          note: values.note,
          grantedById: values.grantedById,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    recordAudit(ctx, 'update', 'addon_entitlement', row!.id, {
      tenantId: body.tenantId,
      addonId: body.addonId,
      isEnabled: values.isEnabled,
      expiresAt: values.expiresAt,
    });

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// DELETE revokes the grant entirely. Data belonging to the addon is left
// untouched - deactivation hides a module, it never deletes school data.
export async function DELETE(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const body = await parseJson(request, revokeSchema);

    const [row] = await db
      .delete(addonEntitlements)
      .where(and(
        eq(addonEntitlements.tenantId, body.tenantId),
        eq(addonEntitlements.addonId, body.addonId),
      ))
      .returning();

    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucune activation trouvée pour ce module.');
    }

    recordAudit(ctx, 'delete', 'addon_entitlement', row.id, {
      tenantId: body.tenantId,
      addonId: body.addonId,
    });

    return NextResponse.json({ success: true, data: { addonId: body.addonId } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
