import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listMovements } from '@/features/inventory/services/reconcile-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const data = await listMovements(tenantId, {
      productId: url.searchParams.get('productId'),
      storeId: url.searchParams.get('storeId'),
      movementType: url.searchParams.get('movementType'),
      refType: url.searchParams.get('refType'),
      refId: url.searchParams.get('refId'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
