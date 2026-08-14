import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createTransfer, listTransfers } from '@/features/inventory/services/transfers-service';

const transferLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.string().trim().min(1).max(20),
}).strict();

const transferCreateSchema = z.object({
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  reason: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(transferLineSchema).min(1).max(100),
  idempotencyKey: z.string().trim().max(80).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listTransfers(tenantId, {
      fromStoreId: url.searchParams.get('fromStoreId'),
      toStoreId: url.searchParams.get('toStoreId'),
      status: url.searchParams.get('status'),
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
    await requireCapability(context, 'inventory.adjust.manage');

    const body = await parseJson(request, transferCreateSchema);
    const data = await createTransfer(context, tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
