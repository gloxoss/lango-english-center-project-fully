import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  createScheduledJob,
  listScheduledJobs,
  scheduledJobInputSchema,
} from '@/features/settings/services/scheduled-jobs-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const rows = await listScheduledJobs(tenantId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.jobs.operate');
    const body = await parseJson(request, scheduledJobInputSchema);
    const created = await createScheduledJob(context, body);
    recordAudit(context, 'create', 'setting_job', created.id, { key: created.key, handler: created.handler });
    return NextResponse.json({ success: true, data: created, message: 'Tâche planifiée créée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
