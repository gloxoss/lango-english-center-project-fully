import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { attachmentTypes, digitalAssets } from '@/features/attachments/models/attachments-schema';
import { AssetService } from '@/features/attachments/services/asset-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'content.manage');

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
    if (context.role === 'teacher' && asset.ownerId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez modifier que vos propres ressources.');
    }

    const [type] = await db.select().from(attachmentTypes).where(and(eq(attachmentTypes.id, asset.attachmentTypeId), eq(attachmentTypes.tenantId, tenantId))).limit(1);
    if (!type) {
      throw new ApiError(404, 'NOT_FOUND', 'Type de pièce jointe introuvable.');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const result = await AssetService.ingestVersion({ tenantId, assetId: id, uploaderId: context.userId, file, attachmentType: type });
    if (result.outcome === 'rejected') {
      return NextResponse.json({ success: false, error: { code: 'INGEST_REJECTED', message: result.reason } }, { status: 422 });
    }

    recordAudit(context, 'update', 'digital_asset', id, { newVersion: result.versionNumber });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
