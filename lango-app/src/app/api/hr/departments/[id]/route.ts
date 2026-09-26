import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { archiveDepartment, updateDepartment } from '@/features/hr/services/organizations-service';
import { db } from '@/libs/DB';
import { departments } from '@/models/Schema';

const departmentPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().max(20).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  headEmployeeId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

/** Load the department's campus inside the tenant, or 404 — the shared gate for PATCH/DELETE. */
async function departmentBranchOr404(tenantId: string, id: string): Promise<string | null> {
  const [row] = await db
    .select({ branchId: departments.branchId })
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Département introuvable dans cet établissement.');
  return row.branchId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.organization.manage');

    assertBranchScope(ctx, await departmentBranchOr404(tenantId, id));
    const body = await parseJson(request, departmentPatchSchema);
    const data = await updateDepartment(tenantId, id, body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.organization.manage');

    assertBranchScope(ctx, await departmentBranchOr404(tenantId, id));
    const data = await archiveDepartment(tenantId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
