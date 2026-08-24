import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import {
  generateDraftPurchaseOrders,
  getReorderSuggestions,
} from '@/features/inventory/services/purchases-service';

const generatePosSchema = z.object({
  orders: z.array(
    z.object({
      supplierId: z.string().uuid(),
      storeId: z.string().uuid(),
      notes: z.string().max(500).optional(),
      lines: z.array(
        z.object({
          productId: z.string().uuid(),
          qtyInPurchaseUnit: z.string().min(1),
          unitCost: z.number().nonnegative(),
        })
      ).min(1),
    })
  ).min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') || undefined;
    const thresholdParam = url.searchParams.get('threshold');
    const threshold = thresholdParam ? Number(thresholdParam) : undefined;

    const data = await getReorderSuggestions(tenantId, { storeId, threshold });
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

    const body = await parseJson(request, generatePosSchema);
    const result = await generateDraftPurchaseOrders(context, tenantId, body.orders);

    recordAudit(context, 'create', 'inventory_auto_purchases', tenantId, {
      count: result.createdCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `${result.createdCount} bon(s) de commande de réapprovisionnement généré(s) avec succès.`,
        ...result,
      },
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
