import { and, asc, eq, ne, notExists } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { employeeProfiles, user } from '@/models/Schema';
import { listEmployees } from '@/features/hr/services/employees-service';

// Access overview: every employee in the tenant with their linked-account
// status (accountName/accountEmail/accountRole/accountStatus) and employment
// state, plus the staff accounts not yet linked to any profile (candidates for
// the one-time link). Gate is hr.access.manage — distinct from the directory's
// hr.employee.read.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.access.manage');

    const [employees, candidates] = await Promise.all([
      listEmployees(tenantId, {}, false),
      db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }).from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          ne(user.role, 'student'),
          notExists(db.select({ one: employeeProfiles.id }).from(employeeProfiles)
            .where(and(eq(employeeProfiles.userId, user.id), eq(employeeProfiles.tenantId, tenantId)))),
        ))
        .orderBy(asc(user.name)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        employees,
        candidates: candidates.filter(c => c.id !== ctx.userId),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
