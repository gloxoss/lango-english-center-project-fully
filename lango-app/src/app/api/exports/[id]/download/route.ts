import { and, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { getExportJob } from '@/libs/services/export-service';
import { capabilityForReportType } from '@/libs/services/exporters';
import { getFile } from '@/libs/services/file-service';
import { files } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const job = await getExportJob(id, tenantId);

    if (!job || job.requestedBy !== context.userId || job.status !== 'complete' || !job.resultPath) {
      throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Export introuvable.');
    }

    const capability = capabilityForReportType(job.reportType);
    if (!capability) {
      throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Export introuvable.');
    }
    await requireCapability(context, capability);

    const [record] = await db.select({ id: files.id })
      .from(files)
      .where(and(
        eq(files.tenantId, tenantId),
        eq(files.storagePath, job.resultPath),
        eq(files.module, 'exports'),
        eq(files.uploadedBy, context.userId),
        eq(files.isDeleted, false),
      ))
      .limit(1);
    if (!record) {
      throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Export introuvable.');
    }

    const file = await getFile(record.id, tenantId);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
