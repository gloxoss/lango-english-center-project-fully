import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { branches, tenants } from '@/models/Schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);
    const { id: schoolId } = await params;

    const [school] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        hasMultiBranchAddon: tenants.hasMultiBranchAddon,
        maxBranches: tenants.maxBranches,
      })
      .from(tenants)
      .where(eq(tenants.id, schoolId))
      .limit(1);

    if (!school) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Établissement introuvable.' } },
        { status: 404 },
      );
    }

    const schoolBranches = await db
      .select()
      .from(branches)
      .where(eq(branches.tenantId, schoolId))
      .orderBy(branches.name);

    return NextResponse.json({
      success: true,
      data: {
        school,
        branches: schoolBranches,
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);
    const { id: schoolId } = await params;

    const body = await request.json();
    const { hasMultiBranchAddon, maxBranches } = body;

    const [updated] = await db
      .update(tenants)
      .set({
        hasMultiBranchAddon: hasMultiBranchAddon !== undefined ? Boolean(hasMultiBranchAddon) : undefined,
        maxBranches: maxBranches !== undefined ? Number(maxBranches) : undefined,
      })
      .where(eq(tenants.id, schoolId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Établissement introuvable.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
