import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { digitalAssets } from '@/features/attachments/models/attachments-schema';
import { AssetService } from '@/features/attachments/services/asset-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const targetSchema = z.object({
  targetKind: z.enum(['school', 'role', 'class_offering', 'class_section', 'class_subject', 'user']),
  targetRoleValue: z.string().optional(),
  targetRefId: z.string().optional(),
});

const updateTargetsSchema = z.object({
  targets: z.array(targetSchema),
}).strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'content.manage');
    const body = await parseJson(request, updateTargetsSchema);

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
    if (context.role === 'teacher' && asset.ownerId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez modifier que vos propres ressources.');
    }
    if (context.role === 'teacher' && body.targets.some(t => t.targetKind === 'school' || t.targetKind === 'role')) {
      throw new ApiError(403, 'FORBIDDEN', 'Seul un administrateur peut cibler toute l\'école ou un rôle entier.');
    }

    await AssetService.setTargets(tenantId, id, body.targets);
    recordAudit(context, 'update', 'digital_asset', id, { targetsChanged: true });

    return NextResponse.json({ success: true, data: { updated: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
