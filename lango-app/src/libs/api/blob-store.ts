import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_ROOT } from '@/libs/api/uploads';

export type BlobStore = {
  put: (key: string, bytes: Buffer) => Promise<void>;
  get: (key: string) => Promise<Buffer>;
  head: (key: string) => Promise<{ size: number } | null>;
  delete: (key: string) => Promise<void>;
};

// Content-addressed, immutable version key - a version is never overwritten,
// only a new version gets a new key. Kept identical to the shape described
// in the attachments-book addon spec so a future S3-compatible adapter needs
// zero business-logic changes, only a new class implementing BlobStore.
export function blobKeyFor(tenantId: string, assetId: string, versionId: string, sha256: string): string {
  return `tenant/${tenantId}/assets/${assetId}/versions/${versionId}/${sha256}`;
}

// Pre-scan write location - never routed to by the download route, so a
// quarantined file is unreachable at the storage layer, not just in app logic.
export function quarantineKeyFor(tenantId: string, uploadId: string): string {
  return `tenant/${tenantId}/quarantine/${uploadId}`;
}

export class LocalDiskBlobStore implements BlobStore {
  async put(key: string, bytes: Buffer): Promise<void> {
    const fullPath = path.join(UPLOADS_ROOT, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(path.join(UPLOADS_ROOT, key));
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const s = await stat(path.join(UPLOADS_ROOT, key));
      return { size: s.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(path.join(UPLOADS_ROOT, key), { force: true });
  }
}

export const blobStore: BlobStore = new LocalDiskBlobStore();
