import { and, count, desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { reportRuns } from '@/addons/advanced-reporting/models/reporting-schema';
import { RunEngine } from '@/addons/advanced-reporting/services/run-engine';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    // Run stuck executions recovery (§21.1)
    await RunEngine.recoverStuckRuns(tenantId);

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const conditions = [eq(reportRuns.tenantId, tenantId)];
    if (context.role !== 'school_admin' && context.role !== 'super_admin') {
      conditions.push(eq(reportRuns.requesterId, context.userId));
    }
    const where = and(...conditions);

    const [runs, totalRows] = await Promise.all([
      db.select().from(reportRuns).where(where).orderBy(desc(reportRuns.createdAt)).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(reportRuns).where(where),
    ]);

    return NextResponse.json({ success: true, data: runs, total: totalRows[0]?.total ?? 0, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
