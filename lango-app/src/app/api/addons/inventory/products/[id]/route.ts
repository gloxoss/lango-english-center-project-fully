import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { archiveProduct, getProduct, updateProduct } from '@/features/inventory/services/catalog-service';

const productPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  purchaseUnitId: z.string().uuid().nullable().optional(),
  saleUnitId: z.string().uuid().nullable().optional(),
  unitRatio: z.string().trim().max(20).optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const data = await getProduct(tenantId, id);
    if (!data) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Produit introuvable dans cet établissement.' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.catalog.manage');

    const body = await parseJson(request, productPatchSchema);
    const data = await updateProduct(tenantId, id, body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.catalog.manage');

    const data = await archiveProduct(tenantId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
