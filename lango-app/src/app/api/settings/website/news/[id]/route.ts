import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { deleteNews, getNewsById, updateNews } from '@/features/website/services/website-service';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const newsUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).regex(slugRegex, 'Slug: lettres minuscules, chiffres et tirets uniquement').optional(),
  excerpt: optionalText(1000),
  coverImageUrl: optionalText(2000),
  body: optionalText(20000),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.iso.datetime().optional().nullable(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.read');

    const item = await getNewsById(tenantId, id);
    if (!item) {
      throw new ApiError(404, 'NOT_FOUND', 'Actualité introuvable.');
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.news.manage');

    const body = await parseJson(request, newsUpdateSchema);
    const item = await updateNews(tenantId, id, body);

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
    await requireCapability(context, 'website.news.manage');

    await deleteNews(tenantId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
