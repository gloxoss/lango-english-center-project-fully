import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { reportSchedules } from '@/addons/advanced-reporting/models/reporting-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.id, id), eq(reportSchedules.tenantId, tenantId)));

    if (!schedule) {
      throw new ApiError(404, 'NOT_FOUND', 'Planification introuvable.');
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.schedule');

    const [deleted] = await db
      .delete(reportSchedules)
      .where(and(eq(reportSchedules.id, id), eq(reportSchedules.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      throw new ApiError(404, 'NOT_FOUND', 'Planification introuvable.');
    }

    recordAudit(context, 'delete', 'report_schedule', id, {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
