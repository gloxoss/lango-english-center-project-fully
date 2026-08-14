import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { employeeProfileEditRequests } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

// GET /api/employee/me/requests — List employee's profile edit requests
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const rows = await db
      .select({
        id: employeeProfileEditRequests.id,
        requestType: employeeProfileEditRequests.requestType,
        proposedChanges: employeeProfileEditRequests.proposedChanges,
        reason: employeeProfileEditRequests.reason,
        status: employeeProfileEditRequests.status,
        reauthenticatedAt: employeeProfileEditRequests.reauthenticatedAt,
        reviewedAt: employeeProfileEditRequests.reviewedAt,
        rejectionReason: employeeProfileEditRequests.rejectionReason,
        createdAt: employeeProfileEditRequests.createdAt,
      })
      .from(employeeProfileEditRequests)
      .where(and(
        eq(employeeProfileEditRequests.tenantId, tenantId),
        eq(employeeProfileEditRequests.userId, ctx.userId),
      ))
      .orderBy(desc(employeeProfileEditRequests.createdAt));

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
