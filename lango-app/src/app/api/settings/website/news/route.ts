import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { parsePagination } from '@/libs/api/pagination';
import { createNews, listNews } from '@/features/website/services/website-service';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const newsCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).regex(slugRegex, 'Slug: lettres minuscules, chiffres et tirets uniquement'),
  excerpt: optionalText(1000),
  coverImageUrl: optionalText(2000),
  body: optionalText(20000),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.iso.datetime().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.read');

    const { searchParams } = new URL(request.url);
    const { limit, offset } = parsePagination(searchParams);
    const { rows, total } = await listNews(tenantId, { limit, offset });

    return NextResponse.json({ success: true, data: rows, meta: { total } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.news.manage');

    const body = await parseJson(request, newsCreateSchema);
    const item = await createNews(tenantId, body);

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
