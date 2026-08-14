import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { archiveStore, updateStore } from '@/features/inventory/services/catalog-service';

const storePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(50).optional(),
  branchId: z.string().uuid().nullable().optional(),
  mobile: z.string().trim().max(50).nullable().optional(),
  address: z.string().max(2000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.catalog.manage');

    const body = await parseJson(request, storePatchSchema);
    const data = await updateStore(tenantId, id, body);

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

    const data = await archiveStore(tenantId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
