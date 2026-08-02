import * as fs from 'node:fs';
import * as path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { files } from '@/models/Schema';

// ---------------------------------------------------------------------------
// File service — local filesystem adapter.
//
// Stores files under data/uploads/<tenantId>/<module>/. The adapter
// interface is designed so swapping to S3/GCS later means only changing
// the read/write/delete implementations, not the callers.
// ---------------------------------------------------------------------------

// Must match src/libs/api/uploads.ts - this is the path the Docker
// `schoolos_uploads` volume is mounted at. Writing anywhere else means
// every uploaded file is lost on container restart.
const UPLOAD_ROOT = process.env.UPLOADS_DIR || '/app/uploads';

// V1 hard limits. These protect the server without configuration.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'text/', 'application/vnd.openxmlformats', 'application/vnd.ms-'];

export type FileMetadata = {
  tenantId: string;
  branchId?: string | null;
  module: string;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
};

/**
 * Upload a file to local storage and record it in the database.
 */
export async function uploadFile(
  meta: FileMetadata,
  buffer: Buffer,
): Promise<{ id: string; storagePath: string }> {
  // Validate size.
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(400, 'FILE_TOO_LARGE',
      `Le fichier dépasse la limite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo.`);
  }

  // Validate MIME type.
  const mimeAllowed = ALLOWED_MIME_PREFIXES.some(prefix => meta.mimeType.startsWith(prefix));
  if (!mimeAllowed) {
    throw new ApiError(400, 'INVALID_FILE_TYPE',
      `Type de fichier non autorisé: ${meta.mimeType}`);
  }

  // Sanitize filename to prevent directory traversal.
  const safeName = meta.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const timestamp = Date.now();
  const storageName = `${timestamp}_${safeName}`;
  // module is caller-supplied and lands in the path too, so it needs the same
  // scrubbing as fileName - otherwise "../../etc" escapes the tenant folder.
  const safeModule = meta.module.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  const dir = path.join(UPLOAD_ROOT, meta.tenantId, safeModule);
  const storagePath = path.join(dir, storageName);

  // Ensure directory exists.
  fs.mkdirSync(dir, { recursive: true });

  // Write file.
  fs.writeFileSync(storagePath, buffer);

  // Record in database.
  const [record] = await db.insert(files).values({
    tenantId: meta.tenantId,
    branchId: meta.branchId ?? null,
    module: meta.module,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    sizeBytes: buffer.length,
    storagePath: storagePath,
    uploadedBy: meta.uploadedBy,
  }).returning();

  return { id: record!.id, storagePath };
}

/**
 * Read a file buffer by ID, verifying tenant ownership.
 */
export async function getFile(
  fileId: string,
  tenantId: string,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const [record] = await db
    .select()
    .from(files)
    .where(and(
      eq(files.id, fileId),
      eq(files.tenantId, tenantId),
      eq(files.isDeleted, false),
    ))
    .limit(1);

  if (!record) {
    throw new ApiError(404, 'FILE_NOT_FOUND', 'Fichier introuvable.');
  }

  if (!fs.existsSync(record.storagePath)) {
    throw new ApiError(404, 'FILE_MISSING', 'Le fichier physique est manquant.');
  }

  const buffer = fs.readFileSync(record.storagePath);
  return { buffer, fileName: record.fileName, mimeType: record.mimeType };
}

/**
 * Soft-delete a file (marks as deleted, does not remove from disk).
 */
export async function deleteFile(
  fileId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(files)
    .set({ isDeleted: true, deletedAt: new Date().toISOString() })
    .where(and(
      eq(files.id, fileId),
      eq(files.tenantId, tenantId),
      eq(files.isDeleted, false),
    ));
}

/**
 * List files for a tenant/module (non-deleted only).
 */
export async function listFiles(
  tenantId: string,
  module?: string,
  limit = 50,
): Promise<Array<{
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  module: string;
  createdAt: string;
}>> {
  const conditions = [
    eq(files.tenantId, tenantId),
    eq(files.isDeleted, false),
  ];
  if (module) {
    conditions.push(eq(files.module, module));
  }

  return db
    .select({
      id: files.id,
      fileName: files.fileName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      module: files.module,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(and(...conditions))
    .limit(limit);
}
