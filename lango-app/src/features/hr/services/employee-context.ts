import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { employeeProfiles, user } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';

type EmploymentBoundary = {
  employmentStatus: string;
  hireDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  archivedAt: string | null;
};

export type EmployeeAccessMode = 'active' | 'retained_read_only';

export function evaluateEmployeeSelfServiceAccess(
  employee: EmploymentBoundary,
  today = new Date().toISOString().slice(0, 10),
): { allowed: boolean; mode?: EmployeeAccessMode } {
  if (employee.archivedAt || employee.employmentStatus === 'archived' || employee.employmentStatus === 'offboarded') {
    return { allowed: false };
  }
  const effectiveStart = employee.contractStartDate ?? employee.hireDate;
  if (effectiveStart && effectiveStart > today) return { allowed: false };

  const activeStatuses = new Set(['active', 'probation', 'on_leave']);
  if (activeStatuses.has(employee.employmentStatus) && (!employee.contractEndDate || employee.contractEndDate >= today)) {
    return { allowed: true, mode: 'active' };
  }

  if (employee.contractEndDate && employee.contractEndDate < today) {
    const end = Date.parse(`${employee.contractEndDate}T00:00:00Z`);
    const current = Date.parse(`${today}T00:00:00Z`);
    if (current - end <= 90 * 24 * 60 * 60 * 1000) return { allowed: true, mode: 'retained_read_only' };
  }
  return { allowed: false };
}

/**
 * Resolve the employee identity of a signed-in user. Self-service is gated by
 * "does this user have an employeeProfiles row", not by role (the source spec's
 * stated identity model: any teacher/accountant/receptionist may also be an
 * employee). Throws 403 for users without a profile so no self-service route
 * ever serves an empty page pretending the user is an employee.
 */
export async function resolveEmployeeContext(
  tenantId: string,
  userId: string,
  options: { allowRetainedReadOnly?: boolean } = {},
) {
  const [row] = await db
    .select({
      id: employeeProfiles.id,
      userId: employeeProfiles.userId,
      tenantId: employeeProfiles.tenantId,
      branchId: employeeProfiles.branchId,
      employeeId: employeeProfiles.employeeId,
      departmentId: employeeProfiles.departmentId,
      designationId: employeeProfiles.designationId,
      managerEmployeeId: employeeProfiles.managerEmployeeId,
      employmentType: employeeProfiles.employmentType,
      employmentStatus: employeeProfiles.employmentStatus,
      hireDate: employeeProfiles.hireDate,
      probationEndDate: employeeProfiles.probationEndDate,
      contractStartDate: employeeProfiles.contractStartDate,
      contractEndDate: employeeProfiles.contractEndDate,
      workloadHours: employeeProfiles.workloadHours,
      cnssNumber: employeeProfiles.cnssNumber,
      amoNumber: employeeProfiles.amoNumber,
      bankRib: employeeProfiles.bankRib,
      contractType: employeeProfiles.contractType,
      dependantsCount: employeeProfiles.dependantsCount,
      createdAt: employeeProfiles.createdAt,
      updatedAt: employeeProfiles.updatedAt,
      archivedAt: employeeProfiles.archivedAt,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(employeeProfiles)
    .innerJoin(user, eq(employeeProfiles.userId, user.id))
    .where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ApiError(403, 'NOT_AN_EMPLOYEE', 'Aucun profil employé associé à ce compte.');
  }

  const access = evaluateEmployeeSelfServiceAccess(row);
  if (!access.allowed || (access.mode === 'retained_read_only' && !options.allowRetainedReadOnly)) {
    throw new ApiError(403, 'EMPLOYMENT_INACTIVE', 'L’accès libre-service n’est pas actif pour ce contrat.');
  }

  return { ...row, accessMode: access.mode! };
}
