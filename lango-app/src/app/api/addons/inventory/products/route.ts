import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createProduct, listProducts } from '@/features/inventory/services/catalog-service';

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  categoryId: z.string().uuid().nullable().optional(),
  purchaseUnitId: z.string().uuid().nullable().optional(),
  saleUnitId: z.string().uuid().nullable().optional(),
  unitRatio: z.string().trim().max(20).optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listProducts(tenantId, {
      categoryId: url.searchParams.get('categoryId'),
      search: url.searchParams.get('search') ?? undefined,
      includeArchived: url.searchParams.get('archived') === 'true',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.catalog.manage');

    const body = await parseJson(request, productSchema);
    const data = await createProduct(tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
