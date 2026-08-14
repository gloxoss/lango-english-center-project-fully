import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createAdjustment, listAdjustments } from '@/features/inventory/services/adjustments-service';

const adjustmentLineSchema = z.object({
  productId: z.string().uuid(),
  direction: z.enum(['in', 'out']),
  qty: z.string().trim().min(1).max(20),
}).strict();

const adjustmentCreateSchema = z.object({
  storeId: z.string().uuid(),
  type: z.enum(['count_correction', 'damage', 'loss', 'donation', 'write_off']),
  reason: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(adjustmentLineSchema).min(1).max(100),
  idempotencyKey: z.string().trim().max(80).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listAdjustments(tenantId, {
      storeId: url.searchParams.get('storeId'),
      type: url.searchParams.get('type'),
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
    await requireCapability(context, 'inventory.adjust.manage');

    const body = await parseJson(request, adjustmentCreateSchema);
    const data = await createAdjustment(context, tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
