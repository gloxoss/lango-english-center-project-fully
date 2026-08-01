import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { exportJobs } from '@/models/Schema';

export type CreateExportJobInput = {
  tenantId: string;
  reportType: string;
  params?: Record<string, unknown>;
  requestedBy: string;
};

/**
 * Create a new export job in pending state.
 */
export async function createExportJob(input: CreateExportJobInput): Promise<string> {
  const [row] = await db
    .insert(exportJobs)
    .values({
      tenantId: input.tenantId,
      reportType: input.reportType,
      params: input.params ?? null,
      status: 'pending',
      requestedBy: input.requestedBy,
    })
    .returning();

  return row!.id;
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
