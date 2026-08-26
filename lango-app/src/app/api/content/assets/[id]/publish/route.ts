import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { digitalAssets } from '@/features/attachments/models/attachments-schema';
import { AssetService } from '@/features/attachments/services/asset-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');
    await requireCapability(context, 'content.manage');

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
    if (context.role === 'teacher' && asset.ownerId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez publier que vos propres ressources.');
    }

    try {
      const updated = await AssetService.publishAsset(tenantId, id);
      recordAudit(context, 'update', 'digital_asset', id, { published: true });
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_READY') {
        throw new ApiError(422, 'NOT_READY', 'La version actuelle n\'est pas prête (analyse antivirus en cours ou échouée).');
      }
      if (err instanceof Error && err.message === 'NO_TARGETS') {
        throw new ApiError(422, 'NO_TARGETS', 'Veuillez définir au moins un public cible avant de publier.');
      }
      throw err;
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
