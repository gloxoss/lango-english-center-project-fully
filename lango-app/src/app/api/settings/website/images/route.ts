import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Single reusable image-upload pipeline for the website CMS (news covers,
// gallery items, hero/slider/service images) - one mechanism instead of a
// bespoke upload endpoint per content type. Public read side is the
// unauthenticated GET /api/public/website/[tenantSlug]/images/[filename].
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.pages.manage');

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const filename = randomUUID();
    const ext = await saveUploadedFile(tenantId, `website/${filename}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const [tenant] = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const url = `/api/public/website/${tenant?.slug ?? ''}/images/${filename}.${ext}`;

    return NextResponse.json({ success: true, data: { url } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
