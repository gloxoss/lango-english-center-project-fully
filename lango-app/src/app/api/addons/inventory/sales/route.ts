import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createSale, listSales } from '@/features/inventory/services/sales-service';

const saleLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.string().trim().min(1).max(20),
  unitPrice: z.number().nonnegative(),
}).strict();

const saleCreateSchema = z.object({
  storeId: z.string().uuid(),
  saleToRole: z.enum(['student', 'staff', 'guest']),
  studentId: z.string().trim().min(1).nullable().optional(),
  customerName: z.string().trim().max(255).nullable().optional(),
  saleDate: z.iso.date(),
  paidAmount: z.number().nonnegative().nullable().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'check']).nullable().optional(),
  paymentReference: z.string().trim().max(100).nullable().optional(),
  lines: z.array(saleLineSchema).min(1).max(100),
  idempotencyKey: z.string().trim().max(80).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listSales(tenantId, {
      storeId: url.searchParams.get('storeId'),
      status: url.searchParams.get('status'),
      saleToRole: url.searchParams.get('saleToRole'),
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
    await requireCapability(context, 'inventory.sell');

    const body = await parseJson(request, saleCreateSchema);
    const data = await createSale(context, tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
