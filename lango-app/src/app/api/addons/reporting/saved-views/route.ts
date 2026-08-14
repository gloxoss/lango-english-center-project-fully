import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reportSavedViews } from '@/addons/advanced-reporting/models/reporting-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createSavedViewSchema = z.object({
  reportKey: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  parameterPreset: z.record(z.string(), z.any()).optional(),
  isShared: z.boolean().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const searchParams = request.nextUrl.searchParams;
    const reportKey = searchParams.get('reportKey');

    const conditions = [
      eq(reportSavedViews.tenantId, tenantId),
      eq(reportSavedViews.ownerId, context.userId),
    ];

    if (reportKey) {
      conditions.push(eq(reportSavedViews.reportKey, reportKey));
    }

    const views = await db
      .select()
      .from(reportSavedViews)
      .where(and(...conditions));

    return NextResponse.json({ success: true, data: views });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const { reportKey, name, parameterPreset, isShared } = await parseJson(request, createSavedViewSchema);

    const [newView] = await db
      .insert(reportSavedViews)
      .values({
        tenantId,
        reportKey,
        name,
        parameters: parameterPreset || {},
        isShared: Boolean(isShared),
        ownerId: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'report_saved_view', newView!.id, { reportKey, name });

    return NextResponse.json({ success: true, data: newView });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Le paramètre id est requis.');
    }

    const conditions = [eq(reportSavedViews.id, id), eq(reportSavedViews.tenantId, tenantId)];
    if (context.role !== 'school_admin' && context.role !== 'super_admin') {
      conditions.push(eq(reportSavedViews.ownerId, context.userId));
    }

    const [deleted] = await db.delete(reportSavedViews).where(and(...conditions)).returning();
    if (!deleted) {
      throw new ApiError(404, 'NOT_FOUND', 'Vue enregistrée introuvable.');
    }

    recordAudit(context, 'delete', 'report_saved_view', id, {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
