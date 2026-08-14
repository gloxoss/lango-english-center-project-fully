import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createStore, listStores } from '@/features/inventory/services/catalog-service';

const storeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(50),
  branchId: z.string().uuid().nullable().optional(),
  mobile: z.string().trim().max(50).nullable().optional(),
  address: z.string().max(2000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const data = await listStores(tenantId, {
      ...(status === 'active' || status === 'archived' ? { status } : {}),
      search: url.searchParams.get('search') ?? undefined,
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

    const body = await parseJson(request, storeSchema);
    const data = await createStore(tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
