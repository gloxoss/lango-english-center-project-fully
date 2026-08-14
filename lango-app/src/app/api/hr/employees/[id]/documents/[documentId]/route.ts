import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { contentTypeFor, readUploadedFile } from '@/libs/api/uploads';
import { getDocument, setDocumentArchived } from '@/features/hr/services/documents-service';

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

function extFromKey(storageKey: string): string {
  const idx = storageKey.lastIndexOf('.');
  return idx >= 0 ? storageKey.slice(idx + 1) : 'jpg';
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.documents.read');

    const { id, documentId } = await params;
    const doc = await getDocument(tenantId, id, documentId);
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document introuvable pour cet employé.');

    const bytes = await readUploadedFile(tenantId, doc.storageKey);
    const ext = extFromKey(doc.storageKey);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentTypeFor(ext),
        'Content-Disposition': `inline; filename="${doc.originalName.replace(/["\\]/g, '')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.documents.manage');

    const { id, documentId } = await params;
    const body = await req.json().catch(() => null);
    const archived = body?.archived === true || body?.archived === false ? body.archived : undefined;
    if (archived === undefined) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Le champ "archived" (true|false) est requis.');
    }

    const data = await setDocumentArchived(tenantId, id, documentId, archived);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
