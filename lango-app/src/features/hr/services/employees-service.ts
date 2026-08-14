import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { branches, employeeProfiles, user } from '@/models/Schema';
import { departments, designations, employeeEmploymentEvents } from '@/features/hr/models/hr-schema';
import { reserveEmployeeId } from './employee-id';

// ---------------------------------------------------------------------------
// Employment events (append-only timeline)
// ---------------------------------------------------------------------------

export type EmploymentEventType =
  | 'hired'
  | 'changed_department'
  | 'changed_designation'
  | 'changed_manager'
  | 'employment_status_change'
  | 'access_granted'
  | 'access_revoked'
  | 'offboarded'
  | 'reactivated'
  | 'archived'
  | 'linked_account';

export async function recordEmploymentEvent(
  tenantId: string,
  employeeId: string,
  eventType: EmploymentEventType,
  actorId: string,
  opts: { reason?: string; metadata?: Record<string, unknown>; effectiveAt?: string } = {},
) {
  await db.insert(employeeEmploymentEvents).values({
    tenantId,
    employeeId,
    eventType,
    actorId,
    reason: opts.reason ?? null,
    metadata: opts.metadata ?? null,
    effectiveAt: opts.effectiveAt ?? new Date().toISOString(),
  });
}

export async function listEmploymentEvents(tenantId: string, employeeId: string) {
  return db
    .select({
      id: employeeEmploymentEvents.id,
      eventType: employeeEmploymentEvents.eventType,
      actorId: employeeEmploymentEvents.actorId,
      reason: employeeEmploymentEvents.reason,
      metadata: employeeEmploymentEvents.metadata,
      effectiveAt: employeeEmploymentEvents.effectiveAt,
      createdAt: employeeEmploymentEvents.createdAt,
      actorName: user.name,
    })
    .from(employeeEmploymentEvents)
    .leftJoin(user, eq(employeeEmploymentEvents.actorId, user.id))
    .where(and(
      eq(employeeEmploymentEvents.tenantId, tenantId),
      eq(employeeEmploymentEvents.employeeId, employeeId),
    ))
    .orderBy(desc(employeeEmploymentEvents.effectiveAt));
}

// ---------------------------------------------------------------------------
// Sensitive-field projection (§5)
// ---------------------------------------------------------------------------

const SENSITIVE_PROFILE_COLUMNS = {
  cnssNumber: employeeProfiles.cnssNumber,
  amoNumber: employeeProfiles.amoNumber,
  bankRib: employeeProfiles.bankRib,
  contractType: employeeProfiles.contractType,
  archivedReason: employeeProfiles.archivedReason,
  // nationalId/salary live on the profile for no-login employees and are
  // mirrored onto user when linked — read whichever source is populated.
  nationalId: sql<string>`COALESCE(${employeeProfiles.nationalId}, ${user.nationalId})`,
  salary: sql<string>`COALESCE(${employeeProfiles.salary}, ${user.salary})`,
};

function directoryProjection(sensitive: boolean) {
  return {
    id: employeeProfiles.id,
    userId: employeeProfiles.userId,
    employeeId: employeeProfiles.employeeId,
    firstName: employeeProfiles.firstName,
    lastName: employeeProfiles.lastName,
    email: employeeProfiles.email,
    phone: employeeProfiles.phone,
    profilePhotoUrl: employeeProfiles.photoUrl,
    displayName: sql<string>`COALESCE(
      NULLIF(TRIM(COALESCE(${employeeProfiles.firstName},'') || ' ' || COALESCE(${employeeProfiles.lastName},'')), ''),
      ${user.name}
    )`,
    branchId: employeeProfiles.branchId,
    departmentId: employeeProfiles.departmentId,
    designationId: employeeProfiles.designationId,
    managerEmployeeId: employeeProfiles.managerEmployeeId,
    employmentType: employeeProfiles.employmentType,
    employmentStatus: employeeProfiles.employmentStatus,
    hireDate: employeeProfiles.hireDate,
    contractStartDate: employeeProfiles.contractStartDate,
    contractEndDate: employeeProfiles.contractEndDate,
    workloadHours: employeeProfiles.workloadHours,
    dependantsCount: employeeProfiles.dependantsCount,
    archivedAt: employeeProfiles.archivedAt,
    createdAt: employeeProfiles.createdAt,
    updatedAt: employeeProfiles.updatedAt,
    // Linked account (nullable: no-login employees)
    accountName: user.name,
    accountEmail: user.email,
    accountRole: user.role,
    accountStatus: user.userStatus,
    photoUrl: sql<string>`COALESCE(${employeeProfiles.photoUrl}, ${user.photoUrl})`,
    ...(sensitive ? SENSITIVE_PROFILE_COLUMNS : {}),
    departmentName: sql<string>`(
      SELECT name FROM ${departments} WHERE ${departments.id} = ${employeeProfiles.departmentId}
    )`,
    designationTitle: sql<string>`(
      SELECT title FROM ${designations} WHERE ${designations.id} = ${employeeProfiles.designationId}
    )`,
  };
}

// ---------------------------------------------------------------------------
// Tenant re-verification of foreign ids
// ---------------------------------------------------------------------------

async function verifyBranch(tenantId: string, branchId?: string | null) {
  if (!branchId) return;
  const [row] = await db.select({ id: branches.id }).from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_BRANCH', 'La succursale choisie n\'existe pas dans cet établissement.');
}

async function verifyDepartment(tenantId: string, departmentId?: string | null) {
  if (!departmentId) return;
  const [row] = await db.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_DEPARTMENT', 'Le département choisi n\'existe pas dans cet établissement.');
}

async function verifyDesignation(tenantId: string, designationId?: string | null) {
  if (!designationId) return;
  const [row] = await db.select({ id: designations.id }).from(designations)
    .where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_DESIGNATION', 'Le poste choisi n\'existe pas dans cet établissement.');
}

async function verifyManager(tenantId: string, managerEmployeeId?: string | null) {
  if (!managerEmployeeId) return;
  const [row] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles)
    .where(and(eq(employeeProfiles.id, managerEmployeeId), eq(employeeProfiles.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_MANAGER', 'Le responsable désigné n\'est pas un employé de cet établissement.');
}

/**
 * BFS upward from `targetId` following managerEmployeeId. If `candidateId` is
 * reachable, assigning candidateId as targetId's manager would create a cycle.
 */
async function wouldCreateManagerCycle(tenantId: string, candidateId: string, targetId: string): Promise<boolean> {
  if (candidateId === targetId) return true;
  const frontier = [candidateId];
  const visited = new Set<string>();
  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === targetId) return true;
    const [mgr] = await db.select({ managerEmployeeId: employeeProfiles.managerEmployeeId }).from(employeeProfiles)
      .where(and(eq(employeeProfiles.id, current), eq(employeeProfiles.tenantId, tenantId))).limit(1);
    if (mgr?.managerEmployeeId) frontier.push(mgr.managerEmployeeId);
  }
  return false;
}

// ---------------------------------------------------------------------------
// List / get
// ---------------------------------------------------------------------------

export type EmployeeFilters = {
  search?: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  employmentStatus?: string;
  loginStatus?: 'linked' | 'unlinked';
  role?: string;
};

export async function listEmployees(tenantId: string, filters: EmployeeFilters, sensitive: boolean) {
  const conditions = [eq(employeeProfiles.tenantId, tenantId)];
  const searchCond = filters.search
    ? or(
        ilike(employeeProfiles.employeeId, `%${filters.search}%`),
        ilike(user.name, `%${filters.search}%`),
        ilike(user.email, `%${filters.search}%`),
      )
    : undefined;
  if (searchCond) conditions.push(searchCond);
  if (filters.departmentId) conditions.push(eq(employeeProfiles.departmentId, filters.departmentId));
  if (filters.designationId) conditions.push(eq(employeeProfiles.designationId, filters.designationId));
  if (filters.branchId) conditions.push(eq(employeeProfiles.branchId, filters.branchId));
  if (filters.employmentStatus) conditions.push(eq(employeeProfiles.employmentStatus, filters.employmentStatus));
  if (filters.loginStatus === 'linked') conditions.push(sql`${employeeProfiles.userId} IS NOT NULL`);
  if (filters.loginStatus === 'unlinked') conditions.push(sql`${employeeProfiles.userId} IS NULL`);
  if (filters.role) conditions.push(eq(user.role, filters.role as 'super_admin' | 'school_admin' | 'teacher' | 'accountant' | 'student' | 'alumni' | 'parent' | 'receptionist' | 'guard'));

  return db
    .select(directoryProjection(sensitive))
    .from(employeeProfiles)
    .leftJoin(user, eq(employeeProfiles.userId, user.id))
    .where(and(...conditions))
    .orderBy(asc(employeeProfiles.employeeId ?? employeeProfiles.createdAt));
}

export async function getEmployee(tenantId: string, id: string, sensitive: boolean) {
  const [row] = await db
    .select(directoryProjection(sensitive))
    .from(employeeProfiles)
    .leftJoin(user, eq(employeeProfiles.userId, user.id))
    .where(and(eq(employeeProfiles.id, id), eq(employeeProfiles.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateEmployeeInput = {
  userId?: string | null;
  employeeId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  managerEmployeeId?: string | null;
  employmentType?: string | null;
  employmentStatus?: string;
  hireDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  workloadHours?: number | null;
  dependantsCount?: number;
  // sensitive
  cnssNumber?: string | null;
  amoNumber?: string | null;
  bankRib?: string | null;
  contractType?: string | null;
  nationalId?: string | null;
  salary?: string | null;
};

/**
 * Create an employee profile (+ optional linked account), auto-assign an
 * employee id when omitted, and record the `hired` event in one transaction.
 * The linked account, when provided, must already exist and belong to this
 * tenant — linking is not provisioning (that is provision-access in Phase 4).
 */
export async function createEmployee(tenantId: string, actorId: string, input: CreateEmployeeInput) {
  await verifyBranch(tenantId, input.branchId);
  await verifyDepartment(tenantId, input.departmentId);
  await verifyDesignation(tenantId, input.designationId);
  await verifyManager(tenantId, input.managerEmployeeId);

  let linkedUser: typeof user.$inferSelect | undefined;
  if (input.userId) {
    const [row] = await db.select().from(user).where(and(eq(user.id, input.userId), eq(user.tenantId, tenantId))).limit(1);
    if (!row) throw new ApiError(422, 'INVALID_USER', 'Le compte lié n\'existe pas dans cet établissement.');
    linkedUser = row;
  }

  const employeeId = input.employeeId ?? await reserveEmployeeId(tenantId);

  return await db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(employeeProfiles)
      .values({
        tenantId,
        userId: input.userId ?? null,
        employeeId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        photoUrl: input.photoUrl ?? null,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        designationId: input.designationId ?? null,
        managerEmployeeId: input.managerEmployeeId ?? null,
        employmentType: input.employmentType ?? null,
        employmentStatus: input.employmentStatus ?? 'active',
        hireDate: input.hireDate ?? null,
        contractStartDate: input.contractStartDate ?? null,
        contractEndDate: input.contractEndDate ?? null,
        workloadHours: input.workloadHours ?? null,
        dependantsCount: input.dependantsCount ?? 0,
        cnssNumber: input.cnssNumber ?? null,
        amoNumber: input.amoNumber ?? null,
        bankRib: input.bankRib ?? null,
        contractType: input.contractType ?? 'cdi',
        nationalId: input.nationalId ?? null,
        salary: input.salary ?? null,
      })
      .returning();

    await tx.insert(employeeEmploymentEvents).values({
      tenantId,
      employeeId: profile!.id,
      eventType: 'hired',
      actorId,
      metadata: { employeeId },
      effectiveAt: new Date().toISOString(),
    });

    // Mirror identity onto the linked user account when present (name/photo/
    // phone come from the profile for HR consistency).
    if (linkedUser) {
      const userUpdates: Record<string, unknown> = { employeeId };
      if (input.firstName || input.lastName) {
        userUpdates.name = `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim();
      }
      if (input.firstName) userUpdates.firstName = input.firstName;
      if (input.lastName) userUpdates.lastName = input.lastName;
      if (input.phone) userUpdates.phone = input.phone;
      if (input.photoUrl) userUpdates.photoUrl = input.photoUrl;
      if (input.nationalId) userUpdates.nationalId = input.nationalId;
      if (input.salary) userUpdates.salary = input.salary;
      await tx.update(user).set({ ...userUpdates, updatedAt: new Date().toISOString() })
        .where(and(eq(user.id, input.userId!), eq(user.tenantId, tenantId)));
    }

    return profile;
  });
}

// ---------------------------------------------------------------------------
// Update (with change events)
// ---------------------------------------------------------------------------

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'userId' | 'employeeId'>>;

export async function updateEmployee(tenantId: string, actorId: string, id: string, input: UpdateEmployeeInput) {
  const existing = await getEmployee(tenantId, id, true);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');

  await verifyBranch(tenantId, input.branchId ?? existing.branchId);
  await verifyDepartment(tenantId, input.departmentId ?? existing.departmentId);
  await verifyDesignation(tenantId, input.designationId ?? existing.designationId);

  const newManagerId = input.managerEmployeeId !== undefined
    ? input.managerEmployeeId
    : existing.managerEmployeeId;
  if (newManagerId && existing.managerEmployeeId !== newManagerId) {
    await verifyManager(tenantId, newManagerId);
    if (await wouldCreateManagerCycle(tenantId, newManagerId, id)) {
      throw new ApiError(409, 'MANAGER_CYCLE', 'Ce responsable créerait une boucle hiérarchique.');
    }
  }

  const changes: Array<{ eventType: EmploymentEventType; reason?: string }> = [];
  if (input.departmentId !== undefined && input.departmentId !== existing.departmentId) {
    changes.push({ eventType: 'changed_department', reason: input.departmentId ? 'Affectation département' : 'Retrait de département' });
  }
  if (input.designationId !== undefined && input.designationId !== existing.designationId) {
    changes.push({ eventType: 'changed_designation', reason: input.designationId ? 'Affectation poste' : 'Retrait de poste' });
  }
  if (newManagerId !== undefined && newManagerId !== existing.managerEmployeeId) {
    changes.push({ eventType: 'changed_manager' });
  }
  if (input.employmentStatus !== undefined && input.employmentStatus !== existing.employmentStatus) {
    changes.push({ eventType: 'employment_status_change', reason: `Statut: ${input.employmentStatus}` });
  }

  // Split inputs by target table: employee_profiles columns vs user columns.
  const profileUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const userUpdates: Record<string, unknown> = {};
  for (const field of [
    'branchId', 'departmentId', 'designationId', 'managerEmployeeId',
    'employmentType', 'employmentStatus', 'hireDate', 'contractStartDate',
    'contractEndDate', 'workloadHours', 'dependantsCount',
    'cnssNumber', 'amoNumber', 'bankRib', 'contractType',
    'nationalId', 'salary',
    'firstName', 'lastName', 'email', 'phone', 'photoUrl',
  ] as const) {
    if (input[field] !== undefined) profileUpdates[field] = input[field];
  }
  for (const field of ['firstName', 'lastName', 'email', 'phone', 'photoUrl', 'nationalId', 'salary'] as const) {
    if (input[field] !== undefined) userUpdates[field] = input[field];
  }

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employeeProfiles)
      .set(profileUpdates)
      .where(and(eq(employeeProfiles.id, id), eq(employeeProfiles.tenantId, tenantId)))
      .returning();

    for (const change of changes) {
      await tx.insert(employeeEmploymentEvents).values({
        tenantId,
        employeeId: id,
        eventType: change.eventType,
        actorId,
        reason: change.reason ?? null,
        effectiveAt: new Date().toISOString(),
      });
    }

    // Mirror identity/contact changes onto the linked user account.
    if (existing.userId && Object.keys(userUpdates).length > 0) {
      if (userUpdates.firstName !== undefined || userUpdates.lastName !== undefined) {
        userUpdates.name = `${userUpdates.firstName ?? existing.firstName ?? ''} ${userUpdates.lastName ?? existing.lastName ?? ''}`.trim();
      }
      await tx.update(user).set({ ...userUpdates, updatedAt: new Date().toISOString() })
        .where(and(eq(user.id, existing.userId), eq(user.tenantId, tenantId)));
    }

    return row;
  });
}
