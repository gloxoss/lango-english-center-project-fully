import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { UPLOADS_ROOT } from '@/libs/api/uploads';

const SUPPORT_UPLOADS_ROOT = path.resolve(UPLOADS_ROOT, 'support-attachments');

const ALLOWED_MIME_TYPES: Record<string, { ext: string; type: 'image' | 'video' | 'file' }> = {
  // Images
  'image/png': { ext: 'png', type: 'image' },
  'image/jpeg': { ext: 'jpg', type: 'image' },
  'image/jpg': { ext: 'jpg', type: 'image' },
  'image/webp': { ext: 'webp', type: 'image' },
  'image/gif': { ext: 'gif', type: 'image' },
  // Videos
  'video/mp4': { ext: 'mp4', type: 'video' },
  'video/webm': { ext: 'webm', type: 'video' },
  'video/quicktime': { ext: 'mov', type: 'video' },
  'video/x-matroska': { ext: 'mkv', type: 'video' },
  // Documents
  'application/pdf': { ext: 'pdf', type: 'file' },
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['super_admin', 'school_admin', 'teacher', 'accountant']);
    // Attachments live under the tenant's own folder so a fileKey cannot be
    // handed to another school.
    const tenantId = requireTenant(context);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file === 'string') {
      throw new ApiError(400, 'BAD_REQUEST', 'Aucun fichier transmis.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ApiError(422, 'FILE_TOO_LARGE', 'Le fichier dépasse la limite autorisée de 50 Mo.');
    }

    const mimeInfo = ALLOWED_MIME_TYPES[file.type.toLowerCase()];
    if (!mimeInfo) {
      throw new ApiError(
        422,
        'UNSUPPORTED_TYPE',
        'Format de fichier non pris en charge. Sont acceptés: images (PNG, JPEG, WebP, GIF), vidéos (MP4, WebM, MOV) et PDF.'
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Basic magic byte checks
    if (mimeInfo.ext === 'png') {
      if (buffer.length < 4 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
        throw new ApiError(422, 'INVALID_FILE_HEADER', 'En-tête PNG invalide.');
      }
    } else if (mimeInfo.ext === 'jpg') {
      if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new ApiError(422, 'INVALID_FILE_HEADER', 'En-tête JPEG invalide.');
      }
    }

    // Organize by year-month directory
    const now = new Date();
    const subfolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetDir = path.resolve(SUPPORT_UPLOADS_ROOT, tenantId, subfolder);

    await mkdir(targetDir, { recursive: true });

    const cleanBaseName = path
      .basename(file.name, path.extname(file.name))
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, '_')
      .slice(0, 60);

    const fileName = `${Date.now()}_${randomUUID().slice(0, 8)}_${cleanBaseName}.${mimeInfo.ext}`;
    const fullPath = path.resolve(targetDir, fileName);

    // Prevent path traversal
    if (!fullPath.startsWith(SUPPORT_UPLOADS_ROOT)) {
      throw new ApiError(400, 'INVALID_PATH', 'Chemin de fichier non autorisé.');
    }

    await writeFile(fullPath, buffer);

    const relativeKey = `${tenantId}/${subfolder}/${fileName}`;
    const publicUrl = `/api/support/upload?fileKey=${encodeURIComponent(relativeKey)}`;

    return NextResponse.json({
      success: true,
      data: {
        name: file.name,
        fileKey: relativeKey,
        url: publicUrl,
        size: file.size,
        mimeType: file.type || `video/${mimeInfo.ext}`,
        type: mimeInfo.type,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    // Unauthenticated GET meant any anonymous visitor who knew a fileKey could
    // download another school's support attachments. The global middleware
    // matcher excludes /api, so this route must authenticate itself.
    const context = await requireRequestContext(req, ['super_admin', 'school_admin', 'teacher', 'accountant']);
    const callerTenantId = requireTenant(context);

    const { searchParams } = new URL(req.url);
    const fileKey = searchParams.get('fileKey');

    if (!fileKey) {
      throw new ApiError(400, 'BAD_REQUEST', 'Paramètre fileKey manquant.');
    }

    const safeKey = path.normalize(fileKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(SUPPORT_UPLOADS_ROOT, safeKey);

    if (!fullPath.startsWith(SUPPORT_UPLOADS_ROOT + path.sep)) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès interdit.');
    }

    // New uploads live under <tenantId>/... so a tenant-scoped key must belong to
    // the caller. super_admin is the platform support desk and may read any.
    // Keys with no tenant segment are pre-existing uploads: kept authenticated-
    // only rather than orphaned.
    const relKey = path.relative(SUPPORT_UPLOADS_ROOT, fullPath);
    const firstSegment = relKey.split(path.sep)[0] ?? '';
    const tenantScoped = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment);
    if (tenantScoped && context.role !== 'super_admin' && firstSegment !== callerTenantId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès interdit.');
    }

    let fileStats;
    try {
      fileStats = await stat(fullPath);
    } catch {
      throw new ApiError(404, 'NOT_FOUND', 'Pièce jointe introuvable.');
    }

    const ext = path.extname(fullPath).toLowerCase().replace('.', '');
    const contentType =
      ext === 'mp4'
        ? 'video/mp4'
        : ext === 'webm'
          ? 'video/webm'
          : ext === 'mov'
            ? 'video/quicktime'
            : ext === 'mkv'
              ? 'video/x-matroska'
              : ext === 'png'
                ? 'image/png'
                : ext === 'jpg' || ext === 'jpeg'
                  ? 'image/jpeg'
                  : ext === 'webp'
                    ? 'image/webp'
                    : ext === 'gif'
                      ? 'image/gif'
                      : ext === 'pdf'
                        ? 'application/pdf'
                        : 'application/octet-stream';

    const fileSize = fileStats.size;
    const rangeHeader = req.headers.get('range');

    // Video byte-range streaming support (essential for seeking in HTML5 <video>)
    if (rangeHeader && contentType.startsWith('video/')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] || '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = createReadStream(fullPath, { start, end });
      const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
          // Confidential support evidence must not sit in shared caches for a year.
        'Cache-Control': 'private, max-age=300, must-revalidate',
        },
      });
    }

    const fileStream = createReadStream(fullPath);
    const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        // Confidential support evidence must not sit in shared caches for a year.
        'Cache-Control': 'private, max-age=300, must-revalidate',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
