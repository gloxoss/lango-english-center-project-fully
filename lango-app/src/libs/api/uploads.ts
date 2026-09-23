import { Buffer } from 'node:buffer';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from '@/libs/api/errors';

// ponytail: shared by every tenant-namespaced local-disk upload (student
// photos, teacher photos, student documents, school logo) - local disk via
// a Docker named volume, not S3, works with zero external credentials.
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/uploads';

export function contentTypeFor(ext: string): string {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  if (cleanExt === 'png') {
    return 'image/png';
  }
  if (cleanExt === 'pdf') {
    return 'application/pdf';
  }
  if (cleanExt === 'jpg' || cleanExt === 'jpeg') {
    return 'image/jpeg';
  }
  if (cleanExt === 'webp') {
    return 'image/webp';
  }
  if (cleanExt === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (cleanExt === 'doc') {
    return 'application/msword';
  }
  return 'application/octet-stream';
}

export function resolveTenantPath(tenantId: string, subpath: string): string {
  const tenantRoot = path.resolve(UPLOADS_ROOT, tenantId);
  const targetPath = path.resolve(tenantRoot, subpath);
  if (targetPath !== tenantRoot && !targetPath.startsWith(tenantRoot + path.sep)) {
    throw new ApiError(400, 'INVALID_PATH', 'Chemin de fichier invalide.');
  }
  return targetPath;
}

export type ImageInspectionResult = {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
};

export function inspectImageBuffer(
  bytes: Buffer,
  claimedExt: string,
  options: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    minRatio?: number;
    maxRatio?: number;
  } = {},
): ImageInspectionResult {
  if (!bytes || bytes.length === 0) {
    throw new ApiError(422, 'EMPTY_FILE', 'Le fichier est vide (0 octet).');
  }

  const cleanExt = claimedExt.toLowerCase().replace(/^\./, '');
  const {
    minWidth = 64,
    minHeight = 64,
    maxWidth = 5000,
    maxHeight = 5000,
    minRatio = 0.35,
    maxRatio = 2.8,
  } = options;

  let width = 0;
  let height = 0;
  let format: 'png' | 'jpeg' | 'webp' = 'png';

  if (cleanExt === 'png') {
    if (bytes.length < 24) {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'Fichier PNG incomplet ou corrompu.');
    }
    if (
      bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47
      || bytes[4] !== 0x0D || bytes[5] !== 0x0A || bytes[6] !== 0x1A || bytes[7] !== 0x0A
    ) {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header PNG non valide ou format usurpé.');
    }
    const chunkType = bytes.toString('ascii', 12, 16);
    if (chunkType !== 'IHDR') {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'En-tête IHDR introuvable dans le fichier PNG.');
    }
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    format = 'png';
  } else if (cleanExt === 'jpg' || cleanExt === 'jpeg') {
    if (bytes.length < 4) {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'Fichier JPEG incomplet ou corrompu.');
    }
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header JPEG non valide ou format usurpé.');
    }

    let offset = 2;
    let foundSof = false;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === undefined) {
        break;
      }

      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
        offset += 2;
        continue;
      }

      if (offset + 4 > bytes.length) {
        break;
      }
      const length = bytes.readUInt16BE(offset + 2);

      if (
        marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3
        || marker === 0xC5 || marker === 0xC6 || marker === 0xC7
        || marker === 0xC9 || marker === 0xCA || marker === 0xCB
        || marker === 0xCD || marker === 0xCE || marker === 0xCF
      ) {
        if (offset + 9 > bytes.length) {
          throw new ApiError(422, 'CORRUPTED_IMAGE', 'En-tête SOF JPEG corrompu.');
        }
        height = bytes.readUInt16BE(offset + 5);
        width = bytes.readUInt16BE(offset + 7);
        foundSof = true;
        break;
      }

      offset += 2 + length;
    }

    if (!foundSof || width === 0 || height === 0) {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'Impossible de décoder les dimensions du fichier JPEG.');
    }
    format = 'jpeg';
  } else if (cleanExt === 'webp') {
    if (bytes.length < 30) {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'Fichier WebP incomplet ou corrompu.');
    }
    const riff = bytes.toString('ascii', 0, 4);
    const webp = bytes.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header WebP non valide ou format usurpé.');
    }

    const chunkHeader = bytes.toString('ascii', 12, 16);
    if (chunkHeader === 'VP8 ') {
      width = bytes.readUInt16LE(26) & 0x3FFF;
      height = bytes.readUInt16LE(28) & 0x3FFF;
    } else if (chunkHeader === 'VP8L') {
      if (bytes.length < 25) {
        throw new ApiError(422, 'CORRUPTED_IMAGE', 'Fichier WebP VP8L tronqué.');
      }
      const b1 = bytes[21]!;
      const b2 = bytes[22]!;
      const b3 = bytes[23]!;
      const b4 = bytes[24]!;
      width = 1 + (((b2 & 0x3F) << 8) | b1);
      height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
    } else if (chunkHeader === 'VP8X') {
      width = 1 + bytes.readUIntLE(24, 3);
      height = 1 + bytes.readUIntLE(27, 3);
    } else {
      throw new ApiError(422, 'CORRUPTED_IMAGE', 'Format de compression WebP non supporté.');
    }
    format = 'webp';
  } else {
    throw new ApiError(422, 'VALIDATION_ERROR', `Format d'image ${cleanExt} non supporté.`);
  }

  if (width < minWidth || height < minHeight) {
    throw new ApiError(422, 'IMAGE_TOO_SMALL', `Dimensions trop petites (${width}x${height} px, minimum ${minWidth}x${minHeight} px).`);
  }
  if (width > maxWidth || height > maxHeight) {
    throw new ApiError(422, 'IMAGE_TOO_LARGE', `Dimensions trop grandes (${width}x${height} px, maximum ${maxWidth}x${maxHeight} px).`);
  }

  const ratio = width / height;
  if (ratio < minRatio || ratio > maxRatio) {
    throw new ApiError(
      422,
      'INVALID_ASPECT_RATIO',
      `Ratio d'aspect inadapté (${ratio.toFixed(2)}:1). Les captures panoramiques et bandeaux sont rejetés.`,
    );
  }

  return { width, height, format };
}

export async function deleteUploadedFile(tenantId: string, subpath: string): Promise<boolean> {
  try {
    const fullPath = resolveTenantPath(tenantId, subpath);
    const { unlink } = await import('node:fs/promises');
    await unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}

export async function saveUploadedFile(
  tenantId: string,
  subpath: string,
  file: File,
  allowedTypes: Record<string, string>,
  maxBytes: number,
  options?: { validateImageDimensions?: boolean },
): Promise<string> {
  const ext = allowedTypes[file.type];
  if (!ext) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Format de fichier non supporté.');
  }
  if (file.size <= 0) {
    throw new ApiError(422, 'EMPTY_FILE', 'Le fichier est vide (0 octet).');
  }
  if (file.size > maxBytes) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Fichier trop volumineux (${Math.round(maxBytes / (1024 * 1024))} Mo maximum).`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Deep inspection for image types
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
    if (options?.validateImageDimensions !== false) {
      inspectImageBuffer(bytes, ext);
    }
  } else if (ext === 'pdf') {
    if (bytes.length < 4 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header PDF non valide.');
    }
  }

  const fullPath = resolveTenantPath(tenantId, subpath.replace('{ext}', ext));
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return ext;
}

export async function readUploadedFile(tenantId: string, subpath: string): Promise<Buffer> {
  const fullPath = resolveTenantPath(tenantId, subpath);
  return readFile(fullPath);
}

/**
 * Whether a stored file can actually be served. `tenants.logoUrl` is just a
 * claim - a seeded row, an upload deleted from the volume, or a value written
 * before the file was moved all leave it set with nothing behind it. Screens
 * that decide whether to render an <img> need the filesystem's answer, not the
 * column's, or they request an image the API can only 404.
 */
export async function uploadedFileExists(tenantId: string, subpath: string): Promise<boolean> {
  try {
    await stat(resolveTenantPath(tenantId, subpath));
    return true;
  } catch {
    return false;
  }
}

export type BrandingKind = 'logo' | 'favicon';

/**
 * The file inside the tenant's upload directory that a stored branding value
 * points at.
 *
 * tenants.logoUrl holds a bare filename ('logo.png') because that is what the
 * upload endpoint writes. Rows seeded or written before that convention settled
 * can hold a path instead - the seed used to name '/uploads/seed/atlas-logo.png'.
 * Neither shape is a servable URL, and only the extension is meaningful: the
 * file itself is always stored as `${kind}.${ext}`. So the extension is read off
 * whatever was stored and the rest is treated as a label.
 *
 * Deriving the key here rather than at each call site is the point: the two GET
 * endpoints used to inline `storedUrl.split('.').pop()` and the settings page
 * had a third copy of the same rule, which is one edit away from a page and an
 * endpoint disagreeing about which file they mean.
 */
export function brandingFileKey(storedValue: string, kind: BrandingKind): string {
  // extname, not split('.').pop(): a directory with a dot in it would confuse the
  // latter. Lower-cased because the upload allow-list only ever produces lower.
  const ext = path.extname(storedValue).replace(/^\./, '').toLowerCase() || 'png';
  return `${kind}.${ext}`;
}

/**
 * URL that serves a tenant's logo or favicon to an unauthenticated visitor, or
 * null when there is no file to serve.
 *
 * Null is the important half. The column is a claim, not a fact: a seeded row,
 * an upload deleted from the volume, or a value written before the file moved
 * all leave it set with nothing behind it. Rendering that claim as an <img>
 * src produces a broken image on the public login page, so callers get null and
 * render their fallback instead. This is the unauthenticated counterpart of
 * GET /api/settings/logo, which only serves the caller's own tenant.
 */
export async function publicBrandingUrl(
  tenant: { id: string; slug: string; logoUrl?: string | null; faviconUrl?: string | null },
  kind: BrandingKind = 'logo',
): Promise<string | null> {
  const stored = kind === 'favicon' ? tenant.faviconUrl : tenant.logoUrl;
  if (!stored) {
    return null;
  }
  if (!(await uploadedFileExists(tenant.id, brandingFileKey(stored, kind)))) {
    return null;
  }
  return `/api/public/website/${tenant.slug}/logo${kind === 'favicon' ? '?type=favicon' : ''}`;
}

// Moves a file already saved by saveUploadedFile to a new subpath within the
// same tenant - used to copy an applicant's uploaded documents onto the real
// student record at admission approval.
export async function copyUploadedFile(tenantId: string, fromSubpath: string, toSubpath: string): Promise<void> {
  const srcPath = resolveTenantPath(tenantId, fromSubpath);
  const destPath = resolveTenantPath(tenantId, toSubpath);
  const bytes = await readFile(srcPath);
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, bytes);
}
