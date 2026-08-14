import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getEmployee, updateEmployee } from '@/features/hr/services/employees-service';

const employeePatchSchema = z.object({
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
  cnssNumber: z.string().trim().max(20).nullable().optional(),
  amoNumber: z.string().trim().max(20).nullable().optional(),
  bankRib: z.string().trim().max(34).nullable().optional(),
  contractType: z.enum(['cdi', 'cdd', 'vacation']).nullable().optional(),
  nationalId: z.string().trim().max(100).nullable().optional(),
  salary: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, id, sensitive);
    if (!data) {
      throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.manage');

    const body = await parseJson(request, employeePatchSchema);
    await updateEmployee(tenantId, ctx.userId, id, body);

    // Return the redacted projection so write responses obey the same §5
    // authorization matrix as GET.
    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, id, sensitive);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
