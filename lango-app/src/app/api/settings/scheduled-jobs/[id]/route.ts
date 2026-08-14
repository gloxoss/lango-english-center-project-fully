import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  deleteScheduledJob,
  getScheduledJob,
  scheduledJobInputSchema,
  updateScheduledJob,
} from '@/features/settings/services/scheduled-jobs-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const { id } = await params;
    const job = await getScheduledJob(context, id);
    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const { id } = await params;
    const body = await parseJson(request, scheduledJobInputSchema.partial());
    const updated = await updateScheduledJob(context, id, body);
    recordAudit(context, 'update', 'setting_job', id, { key: updated.key });
    return NextResponse.json({ success: true, data: updated, message: 'Tâche planifiée mise à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const { id } = await params;
    await deleteScheduledJob(context, id);
    recordAudit(context, 'delete', 'setting_job', id, {});
    return NextResponse.json({ success: true, deleted: true, message: 'Tâche planifiée supprimée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
