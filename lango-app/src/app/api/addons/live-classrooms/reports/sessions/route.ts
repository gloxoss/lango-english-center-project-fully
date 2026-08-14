import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listSessionReports } from '@/features/live-classrooms/services/report-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.reports.read');

    const url = new URL(request.url);
    const rows = await listSessionReports(tenantId, {
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      teacherUserId: context.role === 'teacher' ? context.userId : (url.searchParams.get('teacherUserId') ?? undefined),
      classSectionId: url.searchParams.get('classSectionId') ?? undefined,
      providerProfileId: url.searchParams.get('providerProfileId') ?? undefined,
    });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
