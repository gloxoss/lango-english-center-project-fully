import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { toggleScheduledJob } from '@/features/settings/services/scheduled-jobs-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const { id } = await params;
    const updated = await toggleScheduledJob(context, id);
    recordAudit(context, 'update', 'setting_job', id, { action: 'toggle', isActive: updated.isActive });
    return NextResponse.json({
      success: true,
      data: updated,
      message: updated.isActive ? 'Tâche planifiée activée.' : 'Tâche planifiée désactivée.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
