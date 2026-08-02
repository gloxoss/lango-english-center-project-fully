import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { auditLogs, user } from '@/models/Schema';
import { uploadFile } from './file-service';

// ---------------------------------------------------------------------------
// Export implementations, keyed by reportType.
//
// An exporter builds the file, stores it, and returns its storage path. Adding
// a report type means adding one entry here - export-service.ts rejects
// anything not in this map, so there is no way to enqueue a job that nothing
// can complete.
// ---------------------------------------------------------------------------

export type Exporter = (
  tenantId: string,
  params: Record<string, unknown>,
  requestedBy: string,
) => Promise<string>;

/** Quote a CSV field: double the quotes, wrap in quotes. Handles commas and newlines. */
function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
}

const exportAuditLogs: Exporter = async (tenantId, _params, requestedBy) => {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorId: auditLogs.actorId,
      actorName: user.name,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorId, user.id))
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt));

  const csv = toCsv(
    ['ID', 'Date', 'Acteur', 'Action', 'Module', 'ElementID'],
    rows.map(r => [r.id, r.createdAt, r.actorName || r.actorId, r.action, r.entityType, r.entityId]),
  );

  const { storagePath } = await uploadFile(
    {
      tenantId,
      module: 'exports',
      fileName: `audit-logs-${Date.now()}.csv`,
      mimeType: 'text/csv',
      uploadedBy: requestedBy,
    },
    Buffer.from(csv, 'utf8'),
  );

  return storagePath;
};

export const EXPORTERS: Record<string, Exporter> = {
  'audit-logs': exportAuditLogs,
};

export function isKnownReportType(reportType: string): boolean {
  return Object.hasOwn(EXPORTERS, reportType);
}
