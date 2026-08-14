import { and, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { employeeProfiles, user } from '@/models/Schema';
import { employeeDocuments, employeeEmploymentEvents } from '@/features/hr/models/hr-schema';

// HR overview: real headcount split, hires/departures this month, unlinked
// profiles, salary total (hr.sensitive.read only) and documents expiring soon.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');

    const [headcountRows, hiresThisMonth, departuresThisMonth, unlinked, expiring, salaryTotal] = await Promise.all([
      db.select({ employmentStatus: employeeProfiles.employmentStatus, value: count() })
        .from(employeeProfiles)
        .where(eq(employeeProfiles.tenantId, tenantId))
        .groupBy(employeeProfiles.employmentStatus),
      db.select({ value: count() }).from(employeeProfiles)
        .where(and(
          eq(employeeProfiles.tenantId, tenantId),
          sql`${employeeProfiles.hireDate} >= date_trunc('month', now())`,
        )),
      db.select({ value: count() }).from(employeeEmploymentEvents)
        .where(and(
          eq(employeeEmploymentEvents.tenantId, tenantId),
          eq(employeeEmploymentEvents.eventType, 'offboarded'),
          sql`${employeeEmploymentEvents.effectiveAt} >= date_trunc('month', now())`,
        )),
      db.select({ value: count() }).from(employeeProfiles)
        .where(and(eq(employeeProfiles.tenantId, tenantId), sql`${employeeProfiles.userId} IS NULL`)),
      db.select({
        employeeId: employeeDocuments.employeeId,
        employeeName: sql<string>`COALESCE(
          NULLIF(TRIM(COALESCE(${employeeProfiles.firstName},'') || ' ' || COALESCE(${employeeProfiles.lastName},'')), ''),
          ${user.name}
        )`,
        documentType: employeeDocuments.documentType,
        originalName: employeeDocuments.originalName,
        expiryDate: employeeDocuments.expiryDate,
      })
        .from(employeeDocuments)
        .innerJoin(employeeProfiles, eq(employeeDocuments.employeeId, employeeProfiles.id))
        .leftJoin(user, eq(employeeProfiles.userId, user.id))
        .where(and(
          eq(employeeDocuments.tenantId, tenantId),
          sql`${employeeDocuments.archivedAt} IS NULL`,
          sql`${employeeDocuments.expiryDate} IS NOT NULL`,
          sql`${employeeDocuments.expiryDate} < now() + interval '90 days'`,
        ))
        .orderBy(employeeDocuments.expiryDate)
        .limit(20),
      sensitive
        ? db.select({ value: sql<string>`COALESCE(SUM(COALESCE(${employeeProfiles.salary}, ${user.salary})), 0)::numeric::text` })
            .from(employeeProfiles)
            .leftJoin(user, eq(employeeProfiles.userId, user.id))
            .where(and(
              eq(employeeProfiles.tenantId, tenantId),
              sql`${employeeProfiles.employmentStatus} <> 'offboarded'`,
            ))
        : Promise.resolve([{ value: null }]),
    ]);

    const headcount: Record<string, number> = { active: 0, probation: 0, on_leave: 0, offboarded: 0, archived: 0 };
    for (const row of headcountRows) {
      if (row.employmentStatus in headcount) headcount[row.employmentStatus] = row.value;
    }
    const total = headcountRows.reduce((sum, r) => sum + r.value, 0);

    return NextResponse.json({
      success: true,
      data: {
        headcount: { ...headcount, total },
        hiresThisMonth: hiresThisMonth[0]?.value ?? 0,
        departuresThisMonth: departuresThisMonth[0]?.value ?? 0,
        unlinkedAccounts: unlinked[0]?.value ?? 0,
        expiringDocuments: expiring,
        ...(sensitive ? { salaryTotal: salaryTotal[0]?.value ?? null } : {}),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
