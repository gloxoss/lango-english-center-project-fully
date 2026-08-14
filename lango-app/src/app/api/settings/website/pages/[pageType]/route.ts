import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { FIXED_PAGE_TYPES, getPage, upsertPage, type WebsitePageType } from '@/features/website/services/website-service';
import { websitePageContentSchemas, websitePageUpdateSchema } from '@/features/website/models/website-validation';

function assertValidPageType(pageType: string): asserts pageType is WebsitePageType {
  if (!(FIXED_PAGE_TYPES as readonly string[]).includes(pageType)) {
    throw new ApiError(404, 'NOT_FOUND', 'Type de page inconnu.');
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ pageType: string }> }) {
  try {
    const { pageType } = await params;
    assertValidPageType(pageType);
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.read');

    const page = await getPage(tenantId, pageType);
    return NextResponse.json({ success: true, data: page ?? { id: null, tenantId, pageType, title: '', content: {}, published: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ pageType: string }> }) {
  try {
    const { pageType } = await params;
    assertValidPageType(pageType);
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.pages.manage');

    const body = await parseJson(request, websitePageUpdateSchema);
    let content = body.content;
    if (content !== undefined) {
      content = websitePageContentSchemas[pageType].parse(content);
    }

    const page = await upsertPage(tenantId, pageType, { ...body, content });
    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
