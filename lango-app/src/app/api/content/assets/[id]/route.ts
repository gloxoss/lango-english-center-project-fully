import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { attachmentTypes, digitalAssetTagLinks, digitalAssetTags, digitalAssetTargets, digitalAssetUsageLinks, digitalAssetVersions, digitalAssets } from '@/features/attachments/models/attachments-schema';
import { isAssetVisibleToUser } from '@/features/attachments/services/targeting-service';
import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    const isManager = context.role === 'school_admin' || context.role === 'super_admin' || (context.role === 'teacher' && asset.ownerId === context.userId);
    if (!isManager) {
      if (asset.status !== 'published') {
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

    return NextResponse.json({ success: true, data: { ...asset, versions, targets, tags: tagLinks.map(t => t.name), usageLinks } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
