import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachmentTypes, digitalAssetTagLinks, digitalAssetTags, digitalAssetTargets, digitalAssetUsageLinks, digitalAssetVersions, digitalAssets } from '@/features/attachments/models/attachments-schema';
import { isAssetVisibleToUser } from '@/features/attachments/services/targeting-service';
import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { AssetService } from '@/features/attachments/services/asset-service';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';

const targetSchema = z.object({
  targetKind: z.enum(['school', 'role', 'class_offering', 'class_section', 'class_subject', 'user']),
  targetRoleValue: z.string().optional(),
  targetRefId: z.string().optional(),
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  targets: z.array(targetSchema).max(50),
  expiresAt: z.iso.datetime().optional().nullable(),
}).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    const isManager = context.role === 'school_admin' || context.role === 'super_admin' || (context.role === 'teacher' && asset.ownerId === context.userId);
    if (!isManager) {
      if (asset.status !== 'published') {
        throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
      }
      if (asset.unpublishAt && new Date(asset.unpublishAt).getTime() <= Date.now()) {
        throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
      }
      const [type] = await db.select().from(attachmentTypes).where(eq(attachmentTypes.id, asset.attachmentTypeId)).limit(1);
      const targets = await db.select().from(digitalAssetTargets).where(eq(digitalAssetTargets.assetId, id));
      const audience = await resolveStudentAudienceContext(context.userId);
      const viewer = { userId: context.userId, role: context.role, sectionId: audience.sectionId, offeringIds: audience.offeringIds, classSubjectIds: audience.classSubjectIds };
      if (!isAssetVisibleToUser(targets, type?.studentVisible ?? true, viewer)) {
        throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
      }
    }

    const [versions, targets, tagLinks, usageLinks] = await Promise.all([
      db.select().from(digitalAssetVersions).where(eq(digitalAssetVersions.assetId, id)),
      db.select().from(digitalAssetTargets).where(eq(digitalAssetTargets.assetId, id)),
      db.select({ tagId: digitalAssetTagLinks.tagId, name: digitalAssetTags.name }).from(digitalAssetTagLinks).innerJoin(digitalAssetTags, eq(digitalAssetTagLinks.tagId, digitalAssetTags.id)).where(eq(digitalAssetTagLinks.assetId, id)),
      db.select().from(digitalAssetUsageLinks).where(eq(digitalAssetUsageLinks.assetId, id)),
    ]);

    return NextResponse.json({ success: true, data: { ...asset, expiresAt: asset.unpublishAt, versions, targets, tags: tagLinks.map(t => t.name), usageLinks } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');
    const body = await parseJson(request, updateSchema);
    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    if (context.role === 'teacher' && asset.ownerId !== context.userId) throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez modifier que vos propres ressources.');
    if (context.role === 'teacher' && body.targets.some(t => t.targetKind === 'school' || t.targetKind === 'role')) throw new ApiError(403, 'FORBIDDEN', 'Un enseignant ne peut pas cibler toute l’école ou un rôle entier.');
    const [updated] = await db.update(digitalAssets).set({ title: body.title, description: body.description || null, unpublishAt: body.expiresAt || null, updatedAt: new Date().toISOString() }).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).returning();
    await AssetService.setTargets(tenantId, id, body.targets);
    await AssetService.setTags(tenantId, id, body.tags);
    recordAudit(context, 'update', 'digital_asset', id, { title: body.title });
    return NextResponse.json({ success: true, data: { ...updated, expiresAt: updated!.unpublishAt } });
  } catch (error) { return apiErrorResponse(error); }
}

export const PUT = PATCH;
