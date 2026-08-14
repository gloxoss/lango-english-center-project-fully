import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reportFavorites } from '@/addons/advanced-reporting/models/reporting-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const toggleFavoriteSchema = z.object({
  reportKey: z.string().min(1).max(100),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const favorites = await db
      .select()
      .from(reportFavorites)
      .where(and(eq(reportFavorites.tenantId, tenantId), eq(reportFavorites.userId, context.userId)));

    return NextResponse.json({ success: true, data: favorites });
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
    const { reportKey } = await parseJson(request, toggleFavoriteSchema);

    const existing = await db
      .select()
      .from(reportFavorites)
      .where(
        and(
          eq(reportFavorites.tenantId, tenantId),
          eq(reportFavorites.userId, context.userId),
          eq(reportFavorites.reportKey, reportKey),
        ),
      );

    if (existing.length > 0 && existing[0]) {
      await db
        .delete(reportFavorites)
        .where(eq(reportFavorites.id, existing[0].id));

      recordAudit(context, 'delete', 'report_favorite', existing[0].id, { reportKey });
      return NextResponse.json({ success: true, isFavorite: false });
    }

    const [inserted] = await db.insert(reportFavorites).values({
      tenantId,
      userId: context.userId,
      reportKey,
    }).returning();

    recordAudit(context, 'create', 'report_favorite', inserted!.id, { reportKey });
    return NextResponse.json({ success: true, isFavorite: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
