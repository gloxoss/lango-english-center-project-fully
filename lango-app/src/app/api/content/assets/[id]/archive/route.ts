import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { digitalAssets } from '@/features/attachments/models/attachments-schema';
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
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez archiver que vos propres ressources.');
    }

    const updated = await AssetService.archiveAsset(tenantId, id);
    recordAudit(context, 'update', 'digital_asset', id, { archived: true });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
