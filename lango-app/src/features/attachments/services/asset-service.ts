import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { attachmentTypes, digitalAssetTagLinks, digitalAssetTags, digitalAssets, digitalAssetTargets, digitalAssetVersions } from '@/features/attachments/models/attachments-schema';
import { blobKeyFor, blobStore, quarantineKeyFor } from '@/libs/api/blob-store';
import { db } from '@/libs/DB';
import { scanBuffer } from '@/libs/api/malware-scan';

const MIME_FAMILY_MAGIC: Record<string, (bytes: Buffer) => boolean> = {
  png: bytes => bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47,
  jpeg: bytes => bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  pdf: bytes => bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
};

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

const MIME_TO_FAMILY: Record<string, string> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/msword': 'document',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
};

type Target = { targetKind: 'school' | 'role' | 'class_offering' | 'class_section' | 'class_subject' | 'user'; targetRoleValue?: string; targetRefId?: string };

export type IngestResult =
  | { outcome: 'ready'; versionId: string; versionNumber: number }
  | { outcome: 'rejected'; reason: string };

export class AssetService {
  static nextVersionNumberFromExisting(existingNumbers: number[]): number {
    return existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
  }

  static async ingestVersion(params: {
    tenantId: string;
    assetId: string;
    uploaderId: string;
    file: File;
    attachmentType: { maxSizeBytes: number; allowedMimeFamilies: unknown };
  }): Promise<IngestResult> {
    const { tenantId, assetId, uploaderId, file, attachmentType } = params;

    if (file.size > attachmentType.maxSizeBytes) {
      return { outcome: 'rejected', reason: 'Fichier trop volumineux pour ce type de ressource.' };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return { outcome: 'rejected', reason: 'Type de fichier non supporté.' };
    }
    const family = MIME_TO_FAMILY[file.type];
    const allowedFamilies = Array.isArray(attachmentType.allowedMimeFamilies) ? attachmentType.allowedMimeFamilies as string[] : [];
    if (!family || !allowedFamilies.includes(family)) {
      return { outcome: 'rejected', reason: 'Ce type de fichier n\'est pas autorisé pour cette catégorie de ressource.' };
    }
    const magicCheck = MIME_FAMILY_MAGIC[ext === 'jpg' ? 'jpeg' : ext];
    if (magicCheck && !magicCheck(bytes)) {
      return { outcome: 'rejected', reason: 'En-tête de fichier invalide (le contenu ne correspond pas au type déclaré).' };
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const uploadId = `${assetId}-${Date.now()}`;
    const quarantineKey = quarantineKeyFor(tenantId, uploadId);
    await blobStore.put(quarantineKey, bytes);

    const scanResult = await scanBuffer(bytes);
    if (!scanResult.clean) {
      await blobStore.delete(quarantineKey);
      await db.update(digitalAssets).set({ status: 'infected', updatedAt: new Date().toISOString() }).where(eq(digitalAssets.id, assetId));
      return { outcome: 'rejected', reason: 'Fichier infecté détecté par l\'antivirus.' };
    }

    const existing = await db.select({ versionNumber: digitalAssetVersions.versionNumber }).from(digitalAssetVersions).where(eq(digitalAssetVersions.assetId, assetId));
    const versionNumber = AssetService.nextVersionNumberFromExisting(existing.map(e => e.versionNumber));
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const [version] = await db.transaction(async (tx) => {
      const reCheck = await tx.select({ versionNumber: digitalAssetVersions.versionNumber }).from(digitalAssetVersions).where(eq(digitalAssetVersions.assetId, assetId));
      const finalVersionNumber = AssetService.nextVersionNumberFromExisting(reCheck.map(e => e.versionNumber));
      const finalKey = blobKeyFor(tenantId, assetId, `v${finalVersionNumber}`, sha256);

      const inserted = await tx
        .insert(digitalAssetVersions)
        .values({
          assetId,
          versionNumber: finalVersionNumber,
          storageKey: finalKey,
          originalFilename: file.name,
          safeFilename,
          detectedMime: file.type,
          extension: ext,
          byteSize: file.size,
          sha256,
          scanStatus: 'clean',
          uploaderId,
        })
        .returning();

      await tx.update(digitalAssets).set({ currentVersionId: inserted[0]!.id, status: 'ready', updatedAt: new Date().toISOString() }).where(eq(digitalAssets.id, assetId));
      return inserted;
    });

    await blobStore.put(version!.storageKey, bytes);
    await blobStore.delete(quarantineKey);

    return { outcome: 'ready', versionId: version!.id, versionNumber: version!.versionNumber };
  }

  static async createAsset(params: {
    tenantId: string;
    title: string;
    description?: string;
    attachmentTypeId: string;
    ownerId: string;
    language?: string;
    file: File;
  }) {
    const [type] = await db.select().from(attachmentTypes).where(and(eq(attachmentTypes.id, params.attachmentTypeId), eq(attachmentTypes.tenantId, params.tenantId), eq(attachmentTypes.isActive, true))).limit(1);
    if (!type) {
      return { outcome: 'rejected' as const, reason: 'Type de pièce jointe introuvable ou inactif.' };
    }

    const [asset] = await db
      .insert(digitalAssets)
      .values({
        tenantId: params.tenantId,
        title: params.title,
        description: params.description,
        attachmentTypeId: params.attachmentTypeId,
        ownerId: params.ownerId,
        language: params.language,
        status: 'draft',
      })
      .returning();

    const ingestResult = await AssetService.ingestVersion({
      tenantId: params.tenantId,
      assetId: asset!.id,
      uploaderId: params.ownerId,
      file: params.file,
      attachmentType: type,
    });

    return { outcome: ingestResult.outcome, asset: asset!, ingestResult };
  }

  static async setTargets(tenantId: string, assetId: string, targets: Target[]) {
    await db.delete(digitalAssetTargets).where(eq(digitalAssetTargets.assetId, assetId));
    if (targets.length > 0) {
      await db.insert(digitalAssetTargets).values(targets.map(t => ({
        assetId,
        targetKind: t.targetKind,
        targetRoleValue: t.targetRoleValue,
        targetRefId: t.targetRefId,
      })));
    }
  }

  static async setTags(tenantId: string, assetId: string, names: string[]) {
    const normalized = Array.from(new Set(names.map(name => name.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
    await db.transaction(async (tx) => {
      await tx.delete(digitalAssetTagLinks).where(eq(digitalAssetTagLinks.assetId, assetId));
      for (const name of normalized) {
        const [tag] = await tx.insert(digitalAssetTags).values({ tenantId, name }).onConflictDoUpdate({
          target: [digitalAssetTags.tenantId, digitalAssetTags.name],
          set: { name },
        }).returning();
        await tx.insert(digitalAssetTagLinks).values({ assetId, tagId: tag!.id }).onConflictDoNothing();
      }
    });
  }

  static async publishAsset(tenantId: string, assetId: string) {
    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, assetId), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new Error('NOT_FOUND');
    }
    if (asset.status !== 'ready') {
      throw new Error('NOT_READY');
    }
    const targetCount = await db.select({ id: digitalAssetTargets.id }).from(digitalAssetTargets).where(eq(digitalAssetTargets.assetId, assetId));
    if (targetCount.length === 0) {
      throw new Error('NO_TARGETS');
    }

    const [updated] = await db.update(digitalAssets).set({ status: 'published', updatedAt: new Date().toISOString() }).where(eq(digitalAssets.id, assetId)).returning();
    return updated;
  }

  static async archiveAsset(tenantId: string, assetId: string) {
    const [updated] = await db.update(digitalAssets).set({ status: 'archived', updatedAt: new Date().toISOString() }).where(and(eq(digitalAssets.id, assetId), eq(digitalAssets.tenantId, tenantId))).returning();
    if (!updated) {
      throw new Error('NOT_FOUND');
    }
    return updated;
  }
}
