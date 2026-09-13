import { NextResponse } from 'next/server';
import { RunEngine } from '@/addons/advanced-reporting/services/run-engine';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';

/**
 * Sweeps this tenant's report runs for ones whose process died, requeueing those
 * under the attempt cap and failing the rest.
 *
 * Recovery used to happen only as a side effect of someone listing runs, so a
 * run orphaned by a deploy stayed "running" for ever if nobody opened the page.
 * This endpoint is the scheduled entry point: point a cron or the job worker at
 * it. Listing still sweeps opportunistically, which covers the case where a user
 * gets there first.
 *
 * Tenant-scoped deliberately — it is called with a normal session, so it can only
 * ever recover the caller's own runs. The cross-tenant sweep lives in
 * RunEngine.recoverStuckRuns() with no tenantId and has no HTTP surface.
 */
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.manage');

    const result = await RunEngine.recoverStuckRuns(tenantId);

    // Audited only when something actually moved: a sweep that finds nothing is
    // the normal case and would otherwise bury the audit log in noise.
    if (result.requeued > 0 || result.failed > 0) {
      recordAudit(context, 'update', 'report_runs_recovery', tenantId, result);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
