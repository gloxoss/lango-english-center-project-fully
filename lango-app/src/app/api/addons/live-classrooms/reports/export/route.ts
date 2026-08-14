import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { exportSessionReportsCsv } from '@/features/live-classrooms/services/report-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.export');

    const url = new URL(request.url);
    const csvContent = await exportSessionReportsCsv(tenantId, {
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      teacherUserId: context.role === 'teacher' ? context.userId : (url.searchParams.get('teacherUserId') ?? undefined),
      classSectionId: url.searchParams.get('classSectionId') ?? undefined,
      providerProfileId: url.searchParams.get('providerProfileId') ?? undefined,
    });

    const filename = `live-classrooms-${new Date().toISOString().slice(0, 10)}.csv`;
    recordAudit(context, 'export', 'live_class_report', tenantId, { filename });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
