import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { hasAddon } from '@/libs/api/entitlements';
import { parseJson, branchCreateSchema } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import { branches, tenants } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian']);
    // Branch names are read-only display data surfaced in the shared header; the
    // role allowlist above is the gate. `settings.read` would wrongly block
    // any staff role from seeing the current branch label.
    const tenantId = requireTenant(ctx);

    // Project only the columns the UI needs — do not expose tenantId or timestamps
    const branchList = await db
      .select({
        id: branches.id,
        name: branches.name,
        code: branches.code,
        city: branches.city,
        isDefault: branches.isDefault,
        isActive: branches.isActive,
      })
      .from(branches)
      .where(eq(branches.tenantId, tenantId))
      .orderBy(branches.name);

    return NextResponse.json({
      success: true,
      data: branchList,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(ctx, 'settings.organization.manage');
    const tenantId = requireTenant(ctx);

    const { name, code, city, address, phone, email } = await parseJson(request, branchCreateSchema);

    // Check tenant quota & addon status
    const [tenant] = await db
      .select({
        maxBranches: tenants.maxBranches,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Établissement introuvable.' } },
        { status: 404 },
      );
    }

    const [countRow] = await db
      .select({ totalBranches: count() })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)));
    const totalBranches = countRow?.totalBranches ?? 0;

    // Entitlement, not a column: addon_entitlements is now the source of truth
    // (migration 0035 backfilled it from tenants.has_multi_branch_addon).
    // hasAddon rather than requireAddon because a school without the addon is
    // not denied outright - it just cannot go past its single default branch.
    const multiBranchActive = await hasAddon(tenantId, 'multi-branch');

    if (!multiBranchActive && totalBranches >= 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ADDON_REQUIRED',
            message: 'L\'addon Multi-Succursales n\'est pas activé sur votre abonnement.',
          },
        },
        { status: 403 },
      );
    }

    if (totalBranches >= tenant.maxBranches) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Nombre maximal de succursales atteint (${tenant.maxBranches}).`,
          },
        },
        { status: 403 },
      );
    }

    const [created] = await db
      .insert(branches)
      .values({
        tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        isDefault: totalBranches === 0,
        isActive: true,
      })
      .returning();

    recordAudit(ctx, 'create', 'branch', created!.id);

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
