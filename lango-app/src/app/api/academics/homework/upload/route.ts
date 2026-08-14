import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { saveUploadedFile, readUploadedFile, contentTypeFor } from '@/libs/api/uploads';

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const subpath = `homework/${context.userId}/${timestamp}_${safeName}`;

    await saveUploadedFile(tenantId, subpath, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileUrl: `/api/academics/homework/upload?subpath=${encodeURIComponent(subpath)}`,
        fileSize: file.size,
        mimeType: file.type,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const subpath = searchParams.get('subpath');

    if (!subpath) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Le paramètre subpath est requis.');
    }

    const fileBuffer = await readUploadedFile(tenantId, subpath);
    const ext = subpath.split('.').pop() || 'pdf';
    const contentType = contentTypeFor(ext);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(subpath)}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
