import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { reportArtifacts, reportRuns } from '@/addons/advanced-reporting/models/reporting-schema';
import { SecureDownloadService } from '@/addons/advanced-reporting/services/secure-download';
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

    const conditions = [eq(reportRuns.id, id), eq(reportRuns.tenantId, tenantId)];
    if (context.role !== 'school_admin' && context.role !== 'super_admin') {
      conditions.push(eq(reportRuns.requesterId, context.userId));
    }

    const [run] = await db
      .select()
      .from(reportRuns)
      .where(and(...conditions));

    if (!run) {
      throw new ApiError(404, 'NOT_FOUND', 'Exécution de rapport introuvable.');
    }

    const [artifact] = await db
      .select()
      .from(reportArtifacts)
      .where(eq(reportArtifacts.runId, id));

    return NextResponse.json({
      success: true,
      data: {
        ...run,
        artifact: artifact || null,
        downloadUrl: artifact ? SecureDownloadService.getSignedDownloadUrl(id) : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
