import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createPurchase, listPurchases } from '@/features/inventory/services/purchases-service';

const purchaseLineSchema = z.object({
  productId: z.string().uuid(),
  qtyInPurchaseUnit: z.string().trim().min(1).max(20),
  unitCost: z.number().nonnegative(),
}).strict();

const purchaseCreateSchema = z.object({
  supplierId: z.string().uuid(),
  storeId: z.string().uuid(),
  orderDate: z.iso.date(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(purchaseLineSchema).min(1).max(100),
  paidAmount: z.number().nonnegative().nullable().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'check']).nullable().optional(),
  paymentReference: z.string().trim().max(100).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listPurchases(tenantId, {
      supplierId: url.searchParams.get('supplierId'),
      storeId: url.searchParams.get('storeId'),
      status: url.searchParams.get('status'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
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
    await requireCapability(context, 'inventory.purchase.manage');

    const body = await parseJson(request, purchaseCreateSchema);
    const data = await createPurchase(context, tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
