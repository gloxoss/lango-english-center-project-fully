import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { brandingFileKey, contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// One logo (and optional favicon) per tenant - always serves the current
// session's own tenant, no ?id= needed.
// GET /api/settings/logo          → school logo
// GET /api/settings/logo?type=favicon → favicon
// POST /api/settings/logo         → upload school logo
// POST /api/settings/logo?type=favicon → upload favicon
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const isFavicon = searchParams.get('type') === 'favicon';

    const [row] = await db
      .select({ logoUrl: tenants.logoUrl, faviconUrl: tenants.faviconUrl })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const storedUrl = isFavicon ? row?.faviconUrl : row?.logoUrl;
    const kind = isFavicon ? 'favicon' : 'logo';

    if (!storedUrl) {
      return NextResponse.json({ success: false, message: `${isFavicon ? 'Favicon' : 'Logo'} non trouvé` }, { status: 404 });
    }
    const fileKey = brandingFileKey(storedUrl, kind);
    try {
      const bytes = await readUploadedFile(tenantId, fileKey);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { 'Content-Type': contentTypeFor(fileKey.split('.').pop() ?? 'png'), 'Cache-Control': 'private, max-age=3600' },
      });
    } catch {
      return NextResponse.json({ success: false, message: `${isFavicon ? 'Favicon' : 'Logo'} non trouvé` }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'settings.organization.manage');
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const isFavicon = searchParams.get('type') === 'favicon';
    const fileKey = isFavicon ? 'favicon' : 'logo';

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const ext = await saveUploadedFile(tenantId, `${fileKey}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    if (isFavicon) {
      await db.update(tenants).set({ faviconUrl: `${fileKey}.${ext}` }).where(eq(tenants.id, tenantId));
    } else {
      await db.update(tenants).set({ logoUrl: `${fileKey}.${ext}` }).where(eq(tenants.id, tenantId));
    }

    recordAudit(context, 'update', isFavicon ? 'tenant_favicon' : 'tenant_logo', tenantId);

    return NextResponse.json({
      success: true,
      data: { url: `/api/settings/logo${isFavicon ? '?type=favicon' : ''}` },
      message: `${isFavicon ? 'Favicon' : 'Logo'} enregistré avec succès`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
