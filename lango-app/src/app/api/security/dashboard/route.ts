import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { accessResetRequests, auditLogs, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);

    const [failedLogins, lockedUsers, recentResets, recentSecurityAudits] = await Promise.all([
      db
        .select({ totalFailed: sql<number>`coalesce(sum(${user.failedLoginCount}), 0)::int` })
        .from(user)
        .where(eq(user.tenantId, tenantId)),
      db
        .select({ lockedCount: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), isNotNull(user.lockedUntil))),
      db
        .select({ resetCount: sql<number>`count(*)::int` })
        .from(accessResetRequests)
        .where(eq(accessResetRequests.tenantId, tenantId)),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          actorId: auditLogs.actorId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(sql`${auditLogs.createdAt} desc`)
        .limit(10),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        failedLoginAttempts: failedLogins[0]?.totalFailed ?? 0,
        lockedAccountCount: lockedUsers[0]?.lockedCount ?? 0,
        accessResetCount: recentResets[0]?.resetCount ?? 0,
        recentAudits: recentSecurityAudits,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
