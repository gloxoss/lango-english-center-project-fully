import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from '@/libs/api/errors';

// ponytail: shared by every tenant-namespaced local-disk upload (student
// photos, teacher photos, student documents, school logo) - local disk via
// a Docker named volume, not S3, works with zero external credentials.
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/uploads';

export function contentTypeFor(ext: string): string {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  if (cleanExt === 'png') return 'image/png';
  if (cleanExt === 'pdf') return 'application/pdf';
  if (cleanExt === 'jpg' || cleanExt === 'jpeg') return 'image/jpeg';
  if (cleanExt === 'webp') return 'image/webp';
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

export async function saveUploadedFile(
  tenantId: string,
  subpath: string,
  file: File,
  allowedTypes: Record<string, string>,
  maxBytes: number,
): Promise<string> {
  const ext = allowedTypes[file.type];
  if (!ext) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Format de fichier non supporté.');
  }
  if (file.size > maxBytes) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Fichier trop volumineux (${Math.round(maxBytes / (1024 * 1024))} Mo maximum).`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Validate magic bytes against claimed type
  if (ext === 'png') {
    if (bytes.length < 4 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header PNG non valide.');
    }
  } else if (ext === 'jpg' || ext === 'jpeg') {
    if (bytes.length < 3 || bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) {
      throw new ApiError(422, 'INVALID_FILE_HEADER', 'Header JPEG non valide.');
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
