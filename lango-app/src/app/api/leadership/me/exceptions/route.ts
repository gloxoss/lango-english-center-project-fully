import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendanceFlags } from '@/models/Schema';
import { guardIncidents } from '@/features/guard/models/guard-schema';
import { transportIncidents } from '@/features/transport/models/transport-schema';
import { requireLeadershipScope } from '@/features/leadership/services/scope-service';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const scope = await requireLeadershipScope(ctx);
    if (!ctx.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
    if (scope.type !== 'tenant') throw new ApiError(403, 'SCOPED_PROJECTION_NOT_AVAILABLE', 'La projection limitée à ce périmètre est en cours de configuration.');

    const [attendance, guard, transport] = await Promise.all([
      db.select({ severity: attendanceFlags.severity, count: sql<number>`count(*)::int` }).from(attendanceFlags)
        .where(and(eq(attendanceFlags.tenantId, ctx.tenantId), eq(attendanceFlags.status, 'OPEN'))).groupBy(attendanceFlags.severity),
      db.select({ count: sql<number>`count(*)::int` }).from(guardIncidents)
        .where(and(eq(guardIncidents.tenantId, ctx.tenantId), eq(guardIncidents.status, 'open'))),
      db.select({ count: sql<number>`count(*)::int` }).from(transportIncidents)
        .where(and(eq(transportIncidents.tenantId, ctx.tenantId), eq(transportIncidents.status, 'open'))),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        scope,
        attendance: Object.fromEntries(attendance.map(row => [row.severity, row.count])),
        operations: { openGuardIncidents: Number(guard[0]?.count ?? 0), openTransportIncidents: Number(transport[0]?.count ?? 0) },
        privacy: { containsIndividualRecords: false, smallGroupSuppression: 'not-applicable-to-counts' },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) { return apiErrorResponse(error); }
}
