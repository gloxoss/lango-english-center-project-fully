import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { saveUploadedFile, readUploadedFile, contentTypeFor } from '@/libs/api/uploads';

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/zip': 'docx',
  'application/x-zip-compressed': 'docx',
};
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    let fileType = file.type;
    const lowerName = file.name.toLowerCase();
    if (!fileType || fileType === 'application/octet-stream') {
      if (lowerName.endsWith('.docx')) {
        fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (lowerName.endsWith('.doc')) {
        fileType = 'application/msword';
      } else if (lowerName.endsWith('.pdf')) {
        fileType = 'application/pdf';
      } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        fileType = 'image/jpeg';
      } else if (lowerName.endsWith('.png')) {
        fileType = 'image/png';
      } else if (lowerName.endsWith('.webp')) {
        fileType = 'image/webp';
      }
    }

    const normalizedFile = fileType !== file.type
      ? new File([await file.arrayBuffer()], file.name, { type: fileType })
      : file;

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const subpath = `homework/${context.userId}/${timestamp}_${safeName}`;

    await saveUploadedFile(tenantId, subpath, normalizedFile, ALLOWED_TYPES, MAX_SIZE_BYTES);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileUrl: `/api/academics/homework/upload?subpath=${encodeURIComponent(subpath)}`,
        fileSize: file.size,
        mimeType: fileType,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
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
