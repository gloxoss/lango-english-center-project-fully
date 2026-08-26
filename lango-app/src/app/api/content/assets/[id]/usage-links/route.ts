import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { digitalAssets, digitalAssetUsageLinks } from '@/features/attachments/models/attachments-schema';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { liveClassSessions } from '@/models/Schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createUsageLinkSchema = z.object({
  usageType: z.enum(['homework', 'live_class']),
  usageRefId: z.string().uuid(),
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

    const [asset] = await db.select({ id: digitalAssets.id }).from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    const links = await db.select().from(digitalAssetUsageLinks).where(eq(digitalAssetUsageLinks.assetId, id));
    return NextResponse.json({ success: true, data: links });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
    const body = await parseJson(request, createUsageLinkSchema);

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
    if (asset.status !== 'published') {
      throw new ApiError(422, 'NOT_PUBLISHED', 'Seule une ressource publiée peut être réutilisée.');
    }
    if (context.role === 'teacher' && asset.ownerId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez lier que vos propres ressources.');
    }

    if (body.usageType === 'live_class') {
      const [session] = await db.select({ id: liveClassSessions.id }).from(liveClassSessions)
        .where(and(eq(liveClassSessions.id, body.usageRefId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
      if (!session) {
        throw new ApiError(404, 'NOT_FOUND', 'Classe virtuelle introuvable.');
      }
    } else {
      const [homework] = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.id, body.usageRefId), eq(assessmentDefinitions.tenantId, tenantId), eq(assessmentDefinitions.type, 'homework'))).limit(1);
      if (!homework) {
        throw new ApiError(404, 'NOT_FOUND', 'Devoir introuvable.');
      }
    }

    const [created] = await db.insert(digitalAssetUsageLinks).values({ assetId: id, usageType: body.usageType, usageRefId: body.usageRefId }).returning();
    recordAudit(context, 'create', 'digital_asset_usage_link', created!.id, { usageType: body.usageType, usageRefId: body.usageRefId });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');
    await requireCapability(context, 'content.manage');
    const { searchParams } = new URL(request.url);
    const usageRefId = searchParams.get('usageRefId');
    if (!usageRefId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'usageRefId est requis.');
    }

    const [asset] = await db.select().from(digitalAssets).where(and(eq(digitalAssets.id, id), eq(digitalAssets.tenantId, tenantId))).limit(1);
    if (!asset) {
      throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
    if (context.role === 'teacher' && asset.ownerId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez délier que vos propres ressources.');
    }

    await db.delete(digitalAssetUsageLinks).where(and(eq(digitalAssetUsageLinks.assetId, id), eq(digitalAssetUsageLinks.usageRefId, usageRefId)));
    recordAudit(context, 'delete', 'digital_asset_usage_link', id, { usageRefId });

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
