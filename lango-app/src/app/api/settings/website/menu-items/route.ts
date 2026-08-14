import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createMenuItem, listMenuItems } from '@/features/website/services/website-service';

const menuItemCreateSchema = z.object({
  label: z.string().trim().min(1).max(100),
  linkType: z.enum(['page', 'external', 'anchor']),
  linkValue: z.string().trim().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.read');

    const items = await listMenuItems(tenantId);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.menu.manage');

    const body = await parseJson(request, menuItemCreateSchema);
    const item = await createMenuItem(tenantId, body);

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
