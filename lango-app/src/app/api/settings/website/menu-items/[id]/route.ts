import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { deleteMenuItem, updateMenuItem } from '@/features/website/services/website-service';

const menuItemUpdateSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  linkType: z.enum(['page', 'external', 'anchor']).optional(),
  linkValue: z.string().trim().min(1).max(2000).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.menu.manage');

    const body = await parseJson(request, menuItemUpdateSchema);
    const item = await updateMenuItem(tenantId, id, body);

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.menu.manage');

    await deleteMenuItem(tenantId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
