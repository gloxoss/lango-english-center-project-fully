import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { blobStore } from '@/libs/api/blob-store';
import { db } from '@/libs/DB';
import { documentArtifacts } from '../models/document-schema';
import type { DocumentKind } from '../contracts';

export async function findDocumentArtifact(tenantId: string, kind: DocumentKind, sourceId: string) {
  const [artifact] = await db.select().from(documentArtifacts)
    .where(and(eq(documentArtifacts.tenantId, tenantId), eq(documentArtifacts.kind, kind), eq(documentArtifacts.sourceId, sourceId))).limit(1);
  return artifact ?? null;
}

export async function storeIssuedPdf(input: {
  tenantId: string; kind: DocumentKind; sourceId: string; filename: string; bytes: Buffer;
  designVersionId: string | null; actorId: string | null; archiveOrigin?: 'issued' | 'original' | 'reconstruction';
}) {
  const existing = await findDocumentArtifact(input.tenantId, input.kind, input.sourceId);
  if (existing) return existing;
  if (input.bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF artifact is invalid');
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const key = `tenant/${input.tenantId}/documents/${input.kind}/${randomUUID()}/${sha256}.pdf`;
  await blobStore.put(key, input.bytes);
  try {
    const [artifact] = await db.insert(documentArtifacts).values({
      tenantId: input.tenantId, kind: input.kind, sourceId: input.sourceId,
      filename: input.filename.replace(/[^\w.-]/g, '_').slice(0, 255),
      designVersionId: input.designVersionId, storageKey: key, sha256,
      byteSize: input.bytes.length, createdById: input.actorId, archiveOrigin: input.archiveOrigin ?? 'issued',
    }).onConflictDoNothing().returning();
    if (artifact) return artifact;
    await blobStore.delete(key);
    return await findDocumentArtifact(input.tenantId, input.kind, input.sourceId);
  } catch (error) {
    await blobStore.delete(key);
    throw error;
  }
}

export async function readIssuedPdf(storageKey: string, expectedHash: string): Promise<Buffer> {
  const bytes = await blobStore.get(storageKey);
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Stored PDF hash mismatch');
  return bytes;
}
