import { and, count, desc, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { db } from '@/libs/DB';
import { auditLogs, user } from '@/models/Schema';

// ponytail: school_admin only ever sees their own tenant's rows; super_admin
// (tenantId: null) sees everything, since their own actions also have no
// tenant. No requireTenant() call here for that reason - matches the same
// carve-out already used by super-admin routes.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    const filters = [];
    if (context.role === 'school_admin') {
      filters.push(eq(auditLogs.tenantId, context.tenantId!));
    }
    if (entityType) {
      filters.push(eq(auditLogs.entityType, entityType));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    const pagination = parsePagination(searchParams);

    const [rows, totalRows] = await Promise.all([
      db
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
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayFilters = context.role === 'school_admin' ? [eq(auditLogs.tenantId, context.tenantId!)] : [];
    const todayRows = await db
      .select({ todayCount: count() })
      .from(auditLogs)
      .where(and(...todayFilters, gte(auditLogs.createdAt, todayStart.toISOString())));
    const todayCount = todayRows[0]?.todayCount ?? 0;

    return NextResponse.json({
      success: true,
      data: rows,
      total: totalRows[0]?.total ?? 0,
      todayCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
