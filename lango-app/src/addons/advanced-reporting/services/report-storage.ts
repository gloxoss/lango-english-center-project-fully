import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_ROOT } from '@/libs/api/uploads';

// Durable, tenant-namespaced storage for server-GENERATED report exports -
// distinct from saveUploadedFile (which validates a real uploaded File/Blob
// and doesn't apply here, since this buffer is produced by the server
// itself, not a user upload). Reuses the same UPLOADS_ROOT volume and
// tenant-namespacing convention as every other stored file in this app.
// future-implementation/advanced-reporting remediation, section-05.
export async function saveGeneratedFile(tenantId: string, subpath: string, buffer: Buffer): Promise<void> {
  const fullPath = path.join(UPLOADS_ROOT, tenantId, subpath);
  if (!fullPath.startsWith(path.join(UPLOADS_ROOT, tenantId) + path.sep)) {
    throw new Error('Chemin de fichier invalide.');
  }
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
}
