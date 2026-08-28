import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { auditLogs, user } from '@/models/Schema';
import type { PermissionKey } from '@/libs/api/permissions';
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

/** Quote and sanitize a CSV field: prefixes formula triggers (=, +, -, @, \t, \r) with ' and doubles quotes. */
function csvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
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

// Capability required to enqueue each report type.
//
// Without this, POST /api/exports was a privilege-escalation bypass: the route
// only required an authenticated session, so any student, parent, guard or
// librarian could enqueue 'audit-logs' and receive a CSV of the whole tenant's
// audit trail — actor names and every action on every entity — while
// GET /api/audit-logs restricts the same data to school_admin/super_admin.
//
// Every entry in EXPORTERS must have an entry here; the exports route refuses
// to enqueue a report type with no declared capability, so adding an exporter
// without one fails closed rather than silently becoming world-readable.
export const REPORT_CAPABILITIES: Record<string, PermissionKey> = {
  'audit-logs': 'audit.read',
};

export function isKnownReportType(reportType: string): boolean {
  return Object.hasOwn(EXPORTERS, reportType);
}

export function capabilityForReportType(reportType: string): PermissionKey | null {
  return REPORT_CAPABILITIES[reportType] ?? null;
}
