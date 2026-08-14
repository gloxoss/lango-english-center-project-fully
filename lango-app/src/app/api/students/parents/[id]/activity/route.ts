import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { auditLogs, guardianStudents } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

// Real recent-activity log for a guardian, reusing the already-real auditLogs
// table (future-implementation/dropped-features-rebuild) - no new table, no
// fabricated ip/oldValue/newValue columns, matching this app's existing
// audit-log-reader precedent.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'guardians.read');

    const { id: guardianId } = await params;

    const links = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.tenantId, tenantId)));
    const linkIds = links.map(l => l.id);

    const entityConditions = [and(eq(auditLogs.entityType, 'guardian'), eq(auditLogs.entityId, guardianId))!];
    if (linkIds.length > 0) {
      entityConditions.push(and(eq(auditLogs.entityType, 'guardian_student'), inArray(auditLogs.entityId, linkIds))!);
    }

    const entries = await db
      .select({
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        actorId: auditLogs.actorId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tenantId, tenantId),
        or(...entityConditions),
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
