import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from '@/libs/api/errors';

// ponytail: shared by every tenant-namespaced local-disk upload (student
// photos, teacher photos, student documents, school logo) - local disk via
// a Docker named volume, not S3, works with zero external credentials.
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/uploads';

export function contentTypeFor(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'pdf') return 'application/pdf';
  return 'image/jpeg';
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

  const fullPath = path.join(UPLOADS_ROOT, tenantId, subpath.replace('{ext}', ext));
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return ext;
}

export async function readUploadedFile(tenantId: string, subpath: string): Promise<Buffer> {
  const fullPath = path.join(UPLOADS_ROOT, tenantId, subpath);
  if (!fullPath.startsWith(path.join(UPLOADS_ROOT, tenantId) + path.sep)) {
    throw new ApiError(400, 'INVALID_PATH', 'Chemin de fichier invalide.');
  }
  return readFile(fullPath);
}

// Moves a file already saved by saveUploadedFile to a new subpath within the
// same tenant - used to copy an applicant's uploaded documents onto the real
// student record at admission approval.
export async function copyUploadedFile(tenantId: string, fromSubpath: string, toSubpath: string): Promise<void> {
  const bytes = await readFile(path.join(UPLOADS_ROOT, tenantId, fromSubpath));
  const destPath = path.join(UPLOADS_ROOT, tenantId, toSubpath);
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, bytes);
}
