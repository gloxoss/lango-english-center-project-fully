import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { runScheduledJob } from '@/features/settings/services/scheduled-jobs-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const { id } = await params;
    const result = await runScheduledJob(tenantId, id, 'manual', context.userId);
    recordAudit(context, 'update', 'setting_job', id, { action: 'trigger', status: result.status });
    return NextResponse.json({
      success: true,
      data: result.run,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
