import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { branches, employeeProfiles } from '@/models/Schema';
import { departments, designations } from '@/features/hr/models/hr-schema';

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export type DepartmentInput = {
  name: string;
  code?: string | null;
  branchId?: string | null;
  headEmployeeId?: string | null;
  description?: string | null;
  status?: 'active' | 'archived';
};

async function verifyBranch(tenantId: string, branchId?: string | null): Promise<void> {
  if (!branchId) return;
  const [row] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_BRANCH', 'La succursale choisie n\'existe pas dans cet établissement.');
  }
}

async function verifyHeadEmployee(tenantId: string, headEmployeeId?: string | null): Promise<void> {
  if (!headEmployeeId) return;
  const [row] = await db
    .select({ id: employeeProfiles.id })
    .from(employeeProfiles)
    .where(and(eq(employeeProfiles.id, headEmployeeId), eq(employeeProfiles.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_HEAD', 'Le responsable désigné n\'est pas un employé de cet établissement.');
  }
}

export async function listDepartments(
  tenantId: string,
  opts: { status?: 'active' | 'archived'; search?: string } = {},
) {
  const conditions = [eq(departments.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(departments.status, opts.status));
  const searchCond = opts.search
    ? or(
        ilike(departments.name, `%${opts.search}%`),
        ilike(departments.code ?? departments.name, `%${opts.search}%`),
      )
    : undefined;
  if (searchCond) conditions.push(searchCond);
  return db
    .select({
      id: departments.id,
      tenantId: departments.tenantId,
      branchId: departments.branchId,
      name: departments.name,
      code: departments.code,
      headEmployeeId: departments.headEmployeeId,
      description: departments.description,
      status: departments.status,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
      employeeCount: sql<number>`(
        SELECT COUNT(*) FROM ${employeeProfiles}
        WHERE ${employeeProfiles.tenantId} = ${tenantId}
          AND ${employeeProfiles.departmentId} = ${departments.id}
      )`,
    })
    .from(departments)
    .where(and(...conditions))
    .orderBy(asc(departments.name));
}

export async function getDepartment(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function createDepartment(tenantId: string, input: DepartmentInput) {
  await verifyBranch(tenantId, input.branchId);
  await verifyHeadEmployee(tenantId, input.headEmployeeId);
  const [row] = await db
    .insert(departments)
    .values({
      tenantId,
      name: input.name,
      code: input.code ?? null,
      branchId: input.branchId ?? null,
      headEmployeeId: input.headEmployeeId ?? null,
      description: input.description ?? null,
      status: input.status ?? 'active',
    })
    .returning();
  return row;
}

export async function updateDepartment(tenantId: string, id: string, input: Partial<DepartmentInput>) {
  const existing = await getDepartment(tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Département introuvable dans cet établissement.');
  }
  await verifyBranch(tenantId, input.branchId ?? existing.branchId);
  await verifyHeadEmployee(tenantId, input.headEmployeeId ?? existing.headEmployeeId);
  const [row] = await db
    .update(departments)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.headEmployeeId !== undefined ? { headEmployeeId: input.headEmployeeId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
    .returning();
  return row;
}

/**
 * Archive-only delete. Departments with assigned employees are kept and the
 * caller receives 409 IN_USE.
 */
export async function archiveDepartment(tenantId: string, id: string) {
  const existing = await getDepartment(tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Département introuvable dans cet établissement.');
  }
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeeProfiles)
    .where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.departmentId, id)));
  const assigned = Number(countRow?.count ?? 0);

  if (assigned > 0) {
    throw new ApiError(409, 'IN_USE', `Impossible d\'archiver: ${assigned} employé(s) rattaché(s) à ce département.`);
  }
  const [row] = await db
    .update(departments)
    .set({ status: 'archived', updatedAt: new Date().toISOString() })
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Designations
// ---------------------------------------------------------------------------

export type DesignationInput = {
  title: string;
  code?: string | null;
  departmentId?: string | null;
  description?: string | null;
  status?: 'active' | 'archived';
};

async function verifyDepartment(tenantId: string, departmentId?: string | null): Promise<void> {
  if (!departmentId) return;
  const [row] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_DEPARTMENT', 'Le département choisi n\'existe pas dans cet établissement.');
  }
}

export async function listDesignations(
  tenantId: string,
  opts: { status?: 'active' | 'archived'; search?: string } = {},
) {
  const conditions = [eq(designations.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(designations.status, opts.status));
  const searchCond = opts.search
    ? or(
        ilike(designations.title, `%${opts.search}%`),
        ilike(designations.code ?? designations.title, `%${opts.search}%`),
      )
    : undefined;
  if (searchCond) conditions.push(searchCond);
  return db
    .select({
      id: designations.id,
      tenantId: designations.tenantId,
      departmentId: designations.departmentId,
      title: designations.title,
      code: designations.code,
      description: designations.description,
      status: designations.status,
      createdAt: designations.createdAt,
      updatedAt: designations.updatedAt,
      employeeCount: db.$count(
        employeeProfiles,
        and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.designationId, designations.id)),
      ),
    })
    .from(designations)
    .where(and(...conditions))
    .orderBy(asc(designations.title));
}

export async function getDesignation(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(designations)
    .where(and(eq(designations.id, id), eq(designations.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function createDesignation(tenantId: string, input: DesignationInput) {
  await verifyDepartment(tenantId, input.departmentId);
  const [row] = await db
    .insert(designations)
    .values({
      tenantId,
      title: input.title,
      code: input.code ?? null,
      departmentId: input.departmentId ?? null,
      description: input.description ?? null,
      status: input.status ?? 'active',
    })
    .returning();
  return row;
}

export async function updateDesignation(tenantId: string, id: string, input: Partial<DesignationInput>) {
  const existing = await getDesignation(tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Poste introuvable dans cet établissement.');
  }
  await verifyDepartment(tenantId, input.departmentId ?? existing.departmentId);
  const [row] = await db
    .update(designations)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(designations.id, id), eq(designations.tenantId, tenantId)))
    .returning();
  return row;
}

export async function archiveDesignation(tenantId: string, id: string) {
  const existing = await getDesignation(tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Poste introuvable dans cet établissement.');
  }
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeeProfiles)
    .where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.designationId, id)));
  const assigned = Number(countRow?.count ?? 0);
  if (assigned > 0) {
    throw new ApiError(409, 'IN_USE', `Impossible d\'archiver: ${assigned} employé(s) rattaché(s) à ce poste.`);
  }
  const [row] = await db
    .update(designations)
    .set({ status: 'archived', updatedAt: new Date().toISOString() })
    .where(and(eq(designations.id, id), eq(designations.tenantId, tenantId)))
    .returning();
  return row;
}
