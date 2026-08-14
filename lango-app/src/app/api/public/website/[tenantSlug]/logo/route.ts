import { NextResponse } from 'next/server';
import { contentTypeFor, readUploadedFile } from '@/libs/api/uploads';
import { resolveTenantBySlug } from '@/features/website/services/website-service';

// Public, unauthenticated equivalent of GET /api/settings/logo (which only
// serves the current session's own tenant) - resolves the tenant by public
// slug instead so the public site can render a different school's branding.
export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { searchParams } = new URL(request.url);
  const isFavicon = searchParams.get('type') === 'favicon';

  const tenant = await resolveTenantBySlug(tenantSlug);
  const storedUrl = isFavicon ? tenant?.faviconUrl : tenant?.logoUrl;
  if (!tenant || !storedUrl) {
    return NextResponse.json({ success: false, message: 'Logo non trouvé' }, { status: 404 });
  }

  const tenantId = tenant.id; // resolved strictly from tenantSlug above - every read below is scoped to it
  const fileKey = isFavicon ? 'favicon' : 'logo';
  const ext = storedUrl.split('.').pop() ?? 'png';
  try {
    const bytes = await readUploadedFile(tenantId, `${fileKey}.${ext}`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Logo non trouvé' }, { status: 404 });
  }
}
