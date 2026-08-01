import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// One logo per tenant - always serves the current session's own tenant, no
// ?id= needed (unlike student/teacher photos, which are one-of-many).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const [row] = await db.select({ logoUrl: tenants.logoUrl }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!row?.logoUrl) {
      return NextResponse.json({ success: false, message: 'Logo non trouvé' }, { status: 404 });
    }
    const ext = row.logoUrl.split('.').pop() ?? 'jpg';
    try {
      const bytes = await readUploadedFile(tenantId, `logo.${ext}`);
      return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'private, max-age=3600' } });
    } catch {
      return NextResponse.json({ success: false, message: 'Logo non trouvé' }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const ext = await saveUploadedFile(tenantId, 'logo.{ext}', file, ALLOWED_TYPES, MAX_SIZE_BYTES);
    await db.update(tenants).set({ logoUrl: `logo.${ext}` }).where(eq(tenants.id, tenantId));

    return NextResponse.json({ success: true, data: { logoUrl: '/api/settings/logo' }, message: 'Logo enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
