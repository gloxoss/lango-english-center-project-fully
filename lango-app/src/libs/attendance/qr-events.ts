import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/libs/DB';
import {
  attendanceScanEvents,
  classSections,
  classes,
  scannerDevices,
  scannerSessions,
  sections,
  user,
} from '@/models/Schema';

const operatorUser = alias(user, 'operator_user');

export type QrEventsFilters = {
  from?: string;
  to?: string;
  classSectionId?: string;
  studentName?: string;
  deviceId?: string;
  operatorId?: string;
  resultStatus?: string;
  rejectionReason?: string;
  limit?: number;
};

export type QrEventRow = {
  id: string;
  scannedAt: string;
  resultStatus: string;
  rejectionReason: string | null;
  stagedStatus: string | null;
  studentId: string | null;
  studentName: string | null;
  sessionId: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  operatorId: string | null;
  operatorName: string | null;
  classSectionId: string | null;
  className: string | null;
  sectionName: string | null;
};

export type QrEventsResult = {
  events: QrEventRow[];
  aggregates: {
    total: number;
    accepted: number;
    rejected: number;
    alreadyScanned: number;
  };
  pairedDeviceCount: number;
  options: {
    operators: { id: string; name: string | null }[];
    devices: { id: string; label: string }[];
  };
};

function buildConditions(tenantId: string, filters: QrEventsFilters) {
  const conditions = [eq(attendanceScanEvents.tenantId, tenantId)];
  if (filters.from) {
    conditions.push(gte(attendanceScanEvents.scannedAt, `${filters.from}T00:00:00.000Z`));
  }
  if (filters.to) {
    conditions.push(lte(attendanceScanEvents.scannedAt, `${filters.to}T23:59:59.999Z`));
  }
  if (filters.classSectionId) {
    conditions.push(eq(attendanceScanEvents.classSectionId, filters.classSectionId));
  }
  if (filters.deviceId) {
    conditions.push(eq(scannerSessions.deviceId, filters.deviceId));
  }
  if (filters.operatorId) {
    conditions.push(eq(scannerSessions.operatorId, filters.operatorId));
  }
  if (filters.resultStatus) {
    conditions.push(eq(attendanceScanEvents.resultStatus, filters.resultStatus));
  }
  if (filters.rejectionReason) {
    conditions.push(eq(attendanceScanEvents.rejectionReason, filters.rejectionReason));
  }
  if (filters.studentName) {
    conditions.push(ilike(user.name, `%${filters.studentName}%`));
  }
  return and(...conditions);
}

/**
 * Shared scan-event query used by the QR reports list route and the CSV/PDF
 * export route so both always reflect the same filter semantics and joins.
 */
export async function queryScanEvents(
  tenantId: string,
  filters: QrEventsFilters,
): Promise<QrEventsResult> {
  const where = buildConditions(tenantId, filters);
  const limit = filters.limit ?? 500;

  const [events, aggRows, pairedDevices, operatorRows, deviceRows] = await Promise.all([
    db
      .select({
        id: attendanceScanEvents.id,
        scannedAt: attendanceScanEvents.scannedAt,
        resultStatus: attendanceScanEvents.resultStatus,
        rejectionReason: attendanceScanEvents.rejectionReason,
        stagedStatus: attendanceScanEvents.stagedStatus,
        studentId: attendanceScanEvents.studentId,
        studentName: user.name,
        sessionId: attendanceScanEvents.sessionId,
        deviceId: scannerSessions.deviceId,
        deviceLabel: scannerDevices.deviceLabel,
        operatorId: scannerSessions.operatorId,
        operatorName: operatorUser.name,
        classSectionId: attendanceScanEvents.classSectionId,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(attendanceScanEvents)
      .leftJoin(user, eq(attendanceScanEvents.studentId, user.id))
      .leftJoin(scannerSessions, eq(attendanceScanEvents.sessionId, scannerSessions.id))
      .leftJoin(scannerDevices, eq(scannerSessions.deviceId, scannerDevices.id))
      .leftJoin(classSections, eq(attendanceScanEvents.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .leftJoin(operatorUser, eq(scannerSessions.operatorId, operatorUser.id))
      .where(where)
      .orderBy(desc(attendanceScanEvents.scannedAt))
      .limit(limit),
    db
      .select({ resultStatus: attendanceScanEvents.resultStatus, n: count() })
      .from(attendanceScanEvents)
      .leftJoin(user, eq(attendanceScanEvents.studentId, user.id))
      .leftJoin(scannerSessions, eq(attendanceScanEvents.sessionId, scannerSessions.id))
      .where(where)
      .groupBy(attendanceScanEvents.resultStatus),
    db
      .select({ n: count() })
      .from(scannerDevices)
      .where(eq(scannerDevices.tenantId, tenantId)),
    // Distinct operators/devices seen in this tenant's scan feed, so the
    // report filter dropdowns stay populated no matter which filter is active.
    db
      .select({ id: scannerSessions.operatorId, name: operatorUser.name })
      .from(scannerSessions)
      .leftJoin(operatorUser, eq(scannerSessions.operatorId, operatorUser.id))
      .where(eq(scannerSessions.tenantId, tenantId))
      .groupBy(scannerSessions.operatorId, operatorUser.name),
    db
      .select({ id: scannerSessions.deviceId, label: scannerDevices.deviceLabel })
      .from(scannerSessions)
      .leftJoin(scannerDevices, eq(scannerSessions.deviceId, scannerDevices.id))
      .where(eq(scannerSessions.tenantId, tenantId))
      .groupBy(scannerSessions.deviceId, scannerDevices.deviceLabel),
  ]);

  const aggregateByStatus = new Map(aggRows.map(r => [r.resultStatus, r.n ?? 0]));

  return {
    events: events as unknown as QrEventRow[],
    aggregates: {
      total: events.length,
      accepted: aggregateByStatus.get('accepted') ?? 0,
      rejected: aggregateByStatus.get('rejected') ?? 0,
      alreadyScanned: aggregateByStatus.get('already_scanned') ?? 0,
    },
    pairedDeviceCount: pairedDevices[0]?.n ?? 0,
    options: {
      operators: operatorRows
        .filter(r => r.id)
        .map(r => ({ id: r.id!, name: r.name })),
      devices: deviceRows
        .filter(r => r.id)
        .map(r => ({ id: r.id!, label: r.label ?? r.id! })),
    },
  };
}
