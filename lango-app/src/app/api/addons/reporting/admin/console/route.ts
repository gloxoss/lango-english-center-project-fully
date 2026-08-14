import { and, count, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { reportArtifacts, reportRuns, reportSchedules } from '@/addons/advanced-reporting/models/reporting-schema';
import { WatermarkService } from '@/addons/advanced-reporting/services/watermark-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

// Fixed policy default (not a fabricated usage figure) - no per-tenant quota
// concept exists anywhere in this schema yet.
const STORAGE_QUOTA_MB = 5000;

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.manage');

    const [watermarks, usedBytesRows, activeSchedulesRows, failedRunsRows] = await Promise.all([
      WatermarkService.getProjectionWatermarks(tenantId),
      db.select({ usedBytes: sql<number>`COALESCE(SUM(${reportArtifacts.fileSizeBytes}), 0)` })
        .from(reportArtifacts)
        .innerJoin(reportRuns, eq(reportArtifacts.runId, reportRuns.id))
        .where(eq(reportRuns.tenantId, tenantId)),
      db.select({ activeSchedulesCount: count() })
        .from(reportSchedules)
        .where(and(eq(reportSchedules.tenantId, tenantId), eq(reportSchedules.isActive, true))),
      db.select({ failedRunsCount: count() })
        .from(reportRuns)
        .where(and(eq(reportRuns.tenantId, tenantId), eq(reportRuns.status, 'failed'))),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        projections: watermarks,
        storageQuotaMb: STORAGE_QUOTA_MB,
        usedStorageMb: Math.round(Number(usedBytesRows[0]?.usedBytes ?? 0) / (1024 * 1024)),
        activeSchedulesCount: activeSchedulesRows[0]?.activeSchedulesCount ?? 0,
        failedRunsCount: failedRunsRows[0]?.failedRunsCount ?? 0,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
