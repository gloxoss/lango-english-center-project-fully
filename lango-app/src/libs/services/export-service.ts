import { and, desc, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { exportJobs } from '@/models/Schema';
import { EXPORTERS, isKnownReportType } from './exporters';

export type CreateExportJobInput = {
  tenantId: string;
  reportType: string;
  params?: Record<string, unknown>;
  requestedBy: string;
};

/**
 * Create an export job and run it.
 *
 * ponytail: runs inline rather than through a queue + worker. Every export
 * the app has today is a single tenant-scoped SELECT that finishes in
 * milliseconds, so a background worker would be infrastructure with nothing
 * to do. The job row and its status column keep the async-shaped contract, so
 * moving to a real worker later means changing this function only - callers
 * and the HTTP API already poll for completion. Move it off-request when an
 * export starts outgrowing a request timeout.
 */
export async function createExportJob(input: CreateExportJobInput): Promise<string> {
  // Reject unknown types up front. Accepting them would write a row that no
  // code can ever complete, leaving the caller polling 'pending' forever.
  if (!isKnownReportType(input.reportType)) {
    throw new ApiError(
      422,
      'UNKNOWN_REPORT_TYPE',
      `Type d'export inconnu: ${input.reportType}.`,
    );
  }

  const [row] = await db
    .insert(exportJobs)
    .values({
      tenantId: input.tenantId,
      reportType: input.reportType,
      params: input.params ?? null,
      status: 'processing',
      requestedBy: input.requestedBy,
    })
    .returning();

  const jobId = row!.id;

  try {
    const resultPath = await EXPORTERS[input.reportType]!(
      input.tenantId,
      input.params ?? {},
      input.requestedBy,
    );
    await db
      .update(exportJobs)
      .set({ status: 'complete', resultPath, completedAt: new Date().toISOString() })
      .where(eq(exportJobs.id, jobId));
  } catch (err) {
    await db
      .update(exportJobs)
      .set({ status: 'failed', completedAt: new Date().toISOString() })
      .where(eq(exportJobs.id, jobId));
    throw err;
  }

  return jobId;
}

/**
 * Get export job status for a user/tenant.
 */
export async function getExportJob(jobId: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(exportJobs)
    .where(and(
      eq(exportJobs.id, jobId),
      eq(exportJobs.tenantId, tenantId),
    ))
    .limit(1);

  return row ?? null;
}

/**
 * List recent export jobs for user.
 */
export async function listExportJobs(tenantId: string, requestedBy: string, limit = 20) {
  return db
    .select()
    .from(exportJobs)
    .where(and(
      eq(exportJobs.tenantId, tenantId),
      eq(exportJobs.requestedBy, requestedBy),
    ))
    .orderBy(desc(exportJobs.createdAt))
    .limit(limit);
}
