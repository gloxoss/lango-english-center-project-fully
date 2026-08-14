import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { createEmployee, getEmployee, listEmployees, type CreateEmployeeInput } from '@/features/hr/services/employees-service';

const employeeSchema = z.object({
  userId: z.string().min(1).nullable().optional(),
  employeeId: z.string().trim().max(50).nullable().optional(),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  photoUrl: z.string().trim().max(1000).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  managerEmployeeId: z.string().uuid().nullable().optional(),
  employmentType: z.enum(['permanent', 'fixed_term', 'part_time', 'contractor', 'internship', 'substitute']).nullable().optional(),
  employmentStatus: z.enum(['active', 'probation', 'on_leave', 'offboarded', 'archived']).optional(),
  hireDate: z.string().date().nullable().optional(),
  contractStartDate: z.string().date().nullable().optional(),
  contractEndDate: z.string().date().nullable().optional(),
  workloadHours: z.number().int().min(0).max(168).nullable().optional(),
  dependantsCount: z.number().int().min(0).max(20).optional(),
  // Sensitive — accepted on write (hr.employee.manage), redacted on read
  cnssNumber: z.string().trim().max(20).nullable().optional(),
  amoNumber: z.string().trim().max(20).nullable().optional(),
  bankRib: z.string().trim().max(34).nullable().optional(),
  contractType: z.enum(['cdi', 'cdd', 'vacation']).nullable().optional(),
  nationalId: z.string().trim().max(100).nullable().optional(),
  salary: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const departmentId = url.searchParams.get('departmentId') ?? undefined;
    const designationId = url.searchParams.get('designationId') ?? undefined;
    const branchId = url.searchParams.get('branchId') ?? undefined;
    const employmentStatus = url.searchParams.get('employmentStatus') ?? undefined;
    const loginStatus = url.searchParams.get('loginStatus') as 'linked' | 'unlinked' | undefined;
    const role = url.searchParams.get('role') ?? undefined;

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await listEmployees(tenantId, {
      search, departmentId, designationId, branchId, employmentStatus, loginStatus, role,
    }, sensitive);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.manage');

    const body = await parseJson(request, employeeSchema) as CreateEmployeeInput;
    const profile = await createEmployee(tenantId, ctx.userId, body);

    // Re-read through the redacted projection so the write response obeys the
    // same §5 authorization matrix as GET (sensitive fields absent when the
    // caller lacks hr.sensitive.read).
    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, profile!.id, sensitive);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
