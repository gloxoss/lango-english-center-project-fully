import { NextResponse } from 'next/server';
import { contentTypeFor, readUploadedFile } from '@/libs/api/uploads';
import { resolveTenantBySlug } from '@/features/website/services/website-service';

// Public, unauthenticated - serves an image previously uploaded by
// POST /api/settings/website/images for the tenant matching tenantSlug.
// filename is a bare "{uuid}.{ext}" (no path separators), so this can only
// ever read inside <tenant>/website/ - no path-traversal surface.
export async function GET(_request: Request, { params }: { params: Promise<{ tenantSlug: string; filename: string }> }) {
  const { tenantSlug, filename } = await params;

  if (!/^[a-f0-9-]+\.(jpg|jpeg|png)$/i.test(filename)) {
    return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 });
  }

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 });
  }
  const tenantId = tenant.id; // resolved strictly from tenantSlug above - every read below is scoped to it

  const ext = filename.split('.').pop() ?? 'jpg';
  try {
    const bytes = await readUploadedFile(tenantId, `website/${filename}`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Fichier introuvable' }, { status: 404 });
  }
}
