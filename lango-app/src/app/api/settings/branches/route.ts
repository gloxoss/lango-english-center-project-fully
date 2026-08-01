import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { branches, tenants } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'accountant', 'receptionist']);
    const tenantId = requireTenant(ctx);

    const branchList = await db
      .select()
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
    const tenantId = requireTenant(ctx);

    const body = await request.json();
    const { name, code, city, address, phone, email } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Le nom et le code de la succursale sont requis.' } },
        { status: 400 },
      );
    }

    // Check tenant quota & addon status
    const [tenant] = await db
      .select({
        hasMultiBranchAddon: tenants.hasMultiBranchAddon,
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

    if (!tenant.hasMultiBranchAddon && totalBranches >= 1) {
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

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
