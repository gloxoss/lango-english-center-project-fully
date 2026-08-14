import { and, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { auditLogs, branches, user } from '@/models/Schema';

// Real KPIs on top of the already-real branch-transfer feature
// (future-implementation/dropped-features-rebuild) - no schema change, both
// numbers come from data the transfer action already writes for real.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.read');

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [transfersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.entityType, 'student_transfer'),
        eq(auditLogs.action, 'update'),
        gte(auditLogs.createdAt, monthStart.toISOString()),
      ));

    const byBranch = await db
      .select({
        branchId: branches.id,
        name: branches.name,
        studentCount: sql<number>`count(${user.id})::int`,
      })
      .from(branches)
      .leftJoin(user, and(
        eq(user.branchId, branches.id),
        eq(user.role, 'student'),
        eq(user.userStatus, 'active'),
      ))
      .where(eq(branches.tenantId, tenantId))
      .groupBy(branches.id, branches.name);

    return NextResponse.json({
      success: true,
      data: {
        transfersThisMonth: transfersRow?.count ?? 0,
        byBranch,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
