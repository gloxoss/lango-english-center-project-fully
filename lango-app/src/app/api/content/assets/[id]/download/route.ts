import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { attachmentTypes, digitalAssetAccessEvents, digitalAssets, digitalAssetTargets, digitalAssetVersions } from '@/features/attachments/models/attachments-schema';
import { isAssetVisibleToUser } from '@/features/attachments/services/targeting-service';
import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import { recordAudit } from '@/libs/api/audit';
import { blobStore } from '@/libs/api/blob-store';
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
      // students/parents (and non-owning teachers) may only ever fetch the
      // CURRENT version of a PUBLISHED asset - never an arbitrary versionId,
      // never a draft/archived/infected one, re-checked on this exact request.
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
    } else if (asset.status === 'archived') {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    if (!asset.currentVersionId) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucune version disponible.');
    }

    const [version] = await db.select().from(digitalAssetVersions).where(eq(digitalAssetVersions.id, asset.currentVersionId)).limit(1);
    if (!version || version.scanStatus !== 'clean') {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    const bytes = await blobStore.get(version.storageKey);

    recordAudit(context, 'update', 'digital_asset', id, { downloaded: true });
    db.insert(digitalAssetAccessEvents).values({ assetId: id, actorId: context.userId, eventType: 'download' }).catch(() => {});

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': version.detectedMime,
        'Content-Disposition': `attachment; filename="${version.safeFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
