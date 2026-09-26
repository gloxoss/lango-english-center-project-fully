import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeProfiles, employeeSalaryAssignments, salaryTemplates, user } from '@/models/Schema';
import { assertBranchScope, branchWhere } from '@/libs/api/portal-scope';

const assignSchema = z.object({
  userId: z.string().min(1),
  templateId: z.string().uuid(),
  baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Salaire de base invalide'),
  effectiveDate: z.string().date(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.read');
    const tenantId = requireTenant(ctx);

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    const rows = await db
      .select({
        id: employeeSalaryAssignments.id,
        userId: employeeSalaryAssignments.userId,
        employeeName: user.name,
        templateId: employeeSalaryAssignments.templateId,
        templateName: salaryTemplates.name,
        baseSalary: employeeSalaryAssignments.baseSalary,
        effectiveDate: employeeSalaryAssignments.effectiveDate,
        createdAt: employeeSalaryAssignments.createdAt,
      })
      .from(employeeSalaryAssignments)
      .innerJoin(user, eq(employeeSalaryAssignments.userId, user.id))
      .leftJoin(employeeProfiles, and(eq(employeeProfiles.userId, employeeSalaryAssignments.userId), eq(employeeProfiles.tenantId, tenantId)))
      .innerJoin(salaryTemplates, eq(employeeSalaryAssignments.templateId, salaryTemplates.id))
      .where(
        and(
          eq(employeeSalaryAssignments.tenantId, tenantId),
          userId ? eq(employeeSalaryAssignments.userId, userId) : undefined,
          branchWhere(ctx, employeeProfiles.branchId),
        ),
      )
      .orderBy(desc(employeeSalaryAssignments.effectiveDate));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, assignSchema);

    // Verify user belongs to tenant
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!targetUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable dans cet établissement.');
    }

    // Campus lock: the target employee must be on the caller's campus.
    const [targetProfile] = await db
      .select({ branchId: employeeProfiles.branchId })
      .from(employeeProfiles)
      .where(and(eq(employeeProfiles.userId, body.userId), eq(employeeProfiles.tenantId, tenantId)))
      .limit(1);
    assertBranchScope(ctx, targetProfile?.branchId ?? null);

    // Verify template belongs to tenant
    const [template] = await db
      .select({ id: salaryTemplates.id })
      .from(salaryTemplates)
      .where(and(eq(salaryTemplates.id, body.templateId), eq(salaryTemplates.tenantId, tenantId)))
      .limit(1);

    if (!template) {
      throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Gabarit salarial introuvable.');
    }

    const [assignment] = await db
      .insert(employeeSalaryAssignments)
      .values({
        tenantId,
        userId: body.userId,
        templateId: body.templateId,
        baseSalary: body.baseSalary,
        effectiveDate: body.effectiveDate,
      })
      .returning();

    recordAudit(ctx, 'create', 'salary_assignment', assignment?.id ?? 'assignment', {});
    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
