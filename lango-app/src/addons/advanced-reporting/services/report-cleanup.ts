import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { UPLOADS_ROOT } from '@/libs/api/uploads';
import { reportArtifacts, reportRuns } from '../models/reporting-schema';

// Deletes expired export files from disk and their report_artifacts row.
// report_runs (the actual run history/metadata) is never touched here - per
// the PRD's "keep run metadata indefinitely, expire files only" decision.
// future-implementation/advanced-reporting remediation, section-05.
export async function cleanupExpiredReportFiles(): Promise<{ deleted: number }> {
  const expired = await db
    .select({ id: reportArtifacts.id, filePath: reportArtifacts.filePath, runId: reportArtifacts.runId })
    .from(reportArtifacts)
    .where(lt(reportArtifacts.expiresAt, new Date().toISOString()));

  let deleted = 0;
  for (const artifact of expired) {
    // tenantId is required to resolve the real on-disk path (uploads are
    // tenant-namespaced) - fetched per-artifact via its parent run.
    const [run] = await db.select({ tenantId: reportRuns.tenantId }).from(reportRuns).where(eq(reportRuns.id, artifact.runId));
    if (!run) {
      continue;
    }
    await unlink(path.join(UPLOADS_ROOT, run.tenantId, artifact.filePath)).catch(() => {});
    await db.delete(reportArtifacts).where(eq(reportArtifacts.id, artifact.id));
    deleted += 1;
  }

  return { deleted };
}
