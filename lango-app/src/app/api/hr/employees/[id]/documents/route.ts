import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { saveUploadedFile } from '@/libs/api/uploads';
import {
  createDocument, isAllowedDocumentType, listDocuments,
} from '@/features/hr/services/documents-service';

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.documents.read');

    const { id } = await params;
    const data = await listDocuments(tenantId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.documents.manage');

    const { id } = await params;
    const formData = await req.formData();
    const documentType = formData.get('documentType');
    const issuedAt = formData.get('issuedAt');
    const expiryDate = formData.get('expiryDate');
    const file = formData.get('file');

    if (typeof documentType !== 'string' || !isAllowedDocumentType(documentType)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Type de document invalide.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const documentId = randomUUID();
    const ext = await saveUploadedFile(tenantId, `hr/employees/${id}/${documentId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const data = await createDocument(tenantId, ctx.userId, id, {
      documentType,
      storageKey: `hr/employees/${id}/${documentId}.${ext}`,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      issuedAt: typeof issuedAt === 'string' && issuedAt ? issuedAt : null,
      expiryDate: typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
