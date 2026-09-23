import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { csvSafeRow } from '@/libs/csv-safe';
import { db } from '@/libs/DB';
import { auditLogs, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);

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

    const csvHeaders = 'ID,Date,Acteur,Action,Module,ElementID\n';
    const csvRows = rows.map((r) => {
      return csvSafeRow([r.id, r.createdAt, r.actorName || r.actorId, r.action, r.entityType, r.entityId]);
    }).join('\n');

    return new NextResponse(csvHeaders + csvRows, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${tenantId}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
