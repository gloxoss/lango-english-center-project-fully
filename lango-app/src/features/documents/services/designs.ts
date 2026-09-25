import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { schoolSettings } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { documentDesigns, documentDesignVersions } from '../models/document-schema';
import { documentDesignSchema, DOCUMENT_DEFAULTS, type DocumentDesign, type DocumentKind } from '../contracts';

export async function resolveDesign(tenantId: string, kind: DocumentKind, useDraft = false): Promise<{ design: DocumentDesign; versionId: string | null }> {
  const [row] = await db.select().from(documentDesigns).where(and(eq(documentDesigns.tenantId, tenantId), eq(documentDesigns.kind, kind))).limit(1);
  if (row && useDraft) return { design: documentDesignSchema.parse(row.draft), versionId: null };
  if (row?.publishedVersionId) {
    const [version] = await db.select().from(documentDesignVersions).where(and(eq(documentDesignVersions.id, row.publishedVersionId), eq(documentDesignVersions.tenantId, tenantId))).limit(1);
    if (version) return { design: documentDesignSchema.parse(version.settings), versionId: version.id };
  }
  const [settings] = await db.select({ header: schoolSettings.documentHeaderStyle }).from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1);
  const variant = settings?.header;
  const safeVariant = variant === 'minimal' || variant === 'moderne' || variant === 'classique' ? variant : 'classique';
  return { design: { ...DOCUMENT_DEFAULTS[kind], variant: safeVariant }, versionId: null };
}

export async function saveDraft(tenantId: string, kind: DocumentKind, actorId: string, design: DocumentDesign) {
  const parsed = documentDesignSchema.parse(design);
  if (kind !== 'receipt' && parsed.pageSize !== 'a4') throw new ApiError(422, 'INVALID_PAGE_SIZE', 'Ce document utilise le format A4.');
  const [row] = await db.insert(documentDesigns).values({ tenantId, kind, draft: parsed, updatedById: actorId })
    .onConflictDoUpdate({ target: [documentDesigns.tenantId, documentDesigns.kind], set: { draft: parsed, updatedById: actorId, updatedAt: new Date().toISOString() } }).returning();
  return row;
}

export async function publishDraft(tenantId: string, kind: DocumentKind, actorId: string) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(documentDesigns).where(and(eq(documentDesigns.tenantId, tenantId), eq(documentDesigns.kind, kind))).for('update').limit(1);
    if (!row) return null;
    const design = documentDesignSchema.parse(row.draft);
    const [latest] = await tx.select({ number: documentDesignVersions.versionNumber }).from(documentDesignVersions)
      .where(and(eq(documentDesignVersions.tenantId, tenantId), eq(documentDesignVersions.designId, row.id)))
      .orderBy(desc(documentDesignVersions.versionNumber)).limit(1);
    const [version] = await tx.insert(documentDesignVersions).values({ tenantId, designId: row.id, versionNumber: (latest?.number ?? 0) + 1, settings: design, publishedById: actorId }).returning();
    if (!version) throw new Error('Could not publish document design');
    await tx.update(documentDesigns).set({ publishedVersionId: version.id, updatedById: actorId, updatedAt: new Date().toISOString() })
      .where(and(eq(documentDesigns.id, row.id), eq(documentDesigns.tenantId, tenantId)));
    return version;
  });
}
