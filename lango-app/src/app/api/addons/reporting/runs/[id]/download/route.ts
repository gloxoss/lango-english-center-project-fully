import { and, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { reportArtifacts, reportRuns } from '@/addons/advanced-reporting/models/reporting-schema';
import { SecureDownloadService } from '@/addons/advanced-reporting/services/secure-download';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { readUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';

const EXPORT_CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

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

    // Defense in depth: real session auth above AND a valid signed link
    // below are both required, per future-implementation/advanced-reporting
    // remediation section-07.
    const expiresParam = request.nextUrl.searchParams.get('expires');
    const sigParam = request.nextUrl.searchParams.get('sig');
    if (!expiresParam || !sigParam || !SecureDownloadService.verifySignature(id, Number(expiresParam), sigParam)) {
      throw new ApiError(403, 'INVALID_SIGNATURE', 'Lien de téléchargement invalide ou expiré.');
    }

    const runConditions = [eq(reportRuns.id, id), eq(reportRuns.tenantId, tenantId)];
    if (context.role !== 'school_admin' && context.role !== 'super_admin') {
      runConditions.push(eq(reportRuns.requesterId, context.userId));
    }

    const [run] = await db.select().from(reportRuns).where(and(...runConditions));
    if (!run) {
      throw new ApiError(404, 'NOT_FOUND', 'Exécution de rapport introuvable.');
    }

    const [artifact] = await db.select().from(reportArtifacts).where(eq(reportArtifacts.runId, id));
    if (!artifact || new Date(artifact.expiresAt) < new Date()) {
      throw new ApiError(404, 'FILE_UNAVAILABLE', 'Ce fichier n\'est plus disponible.');
    }

    const fileBuffer = await readUploadedFile(tenantId, artifact.filePath).catch(() => null);
    if (!fileBuffer) {
      throw new ApiError(404, 'FILE_UNAVAILABLE', 'Ce fichier n\'est plus disponible.');
    }

    await db
      .update(reportArtifacts)
      .set({ downloadCount: sql`${reportArtifacts.downloadCount} + 1` })
      .where(eq(reportArtifacts.id, artifact.id));

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': EXPORT_CONTENT_TYPES[artifact.format] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="report_${run.reportKey}.${artifact.format}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
