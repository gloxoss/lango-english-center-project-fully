import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { compileFormula } from '@/features/workforce/services/expression-engine';
import {
  employeeProfiles, employeeSalaryAssignments, payrollAdjustments, payrollRegulationPacks,
  payrollRegulationVersions, payrollSettingsVersions, salaryComponents, salaryComponentVersions,
  salaryStructureComponents, salaryStructureVersions, salaryTemplates, user,
} from '@/models/Schema';

const resourceSchema = z.enum(['regulations', 'settings', 'components', 'structures', 'assignments', 'adjustments', 'employees']);
const bodySchema = z.discriminatedUnion('resource', [
  z.object({ resource: z.literal('settings'), settings: z.record(z.string(), z.unknown()) }),
  z.object({ resource: z.literal('components'), code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/), name: z.string().trim().min(2).max(160), componentType: z.enum(['earning','deduction','employer','info']), valueType: z.enum(['fixed','percent','formula']), fixedValue: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(), percentOf: z.string().trim().max(40).nullable().optional(), percentBp: z.number().int().min(0).max(100000).nullable().optional(), formula: z.string().trim().max(500).nullable().optional(), taxable: z.boolean().default(true), contributable: z.boolean().default(true), proratable: z.boolean().default(true) }),
  z.object({ resource: z.literal('structures'), name: z.string().trim().min(2).max(160), componentVersionIds: z.array(z.string().uuid()).min(1), effectiveFrom: z.string().date().optional() }),
  z.object({ resource: z.literal('assignments'), userId: z.string().min(1), structureVersionId: z.string().uuid(), baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/), effectiveDate: z.string().date() }),
  z.object({ resource: z.literal('adjustments'), employeeId: z.string().uuid(), userId: z.string().min(1), adjustmentType: z.enum(['bonus','overtime','award','correction','reimbursement','deduction','recovery']), amount: z.string().regex(/^\d+(\.\d{1,2})?$/), reason: z.string().trim().min(2).max(500), year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }),
]);

async function gate(request: Request) {
  const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
  await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.configure');
  return { ctx, tenantId };
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await gate(request);
    const resource = resourceSchema.parse(new URL(request.url).searchParams.get('resource'));
    let data: unknown;
    if (resource === 'regulations') data = await db.select({ pack: payrollRegulationPacks, version: payrollRegulationVersions }).from(payrollRegulationPacks).leftJoin(payrollRegulationVersions, and(eq(payrollRegulationVersions.tenantId, tenantId), eq(payrollRegulationVersions.packId, payrollRegulationPacks.id))).where(eq(payrollRegulationPacks.tenantId, tenantId));
    else if (resource === 'settings') data = await db.select().from(payrollSettingsVersions).where(eq(payrollSettingsVersions.tenantId, tenantId)).orderBy(desc(payrollSettingsVersions.versionNo));
    else if (resource === 'components') data = await db.select({ component: salaryComponents, version: salaryComponentVersions }).from(salaryComponents).leftJoin(salaryComponentVersions, and(eq(salaryComponentVersions.tenantId, tenantId), eq(salaryComponentVersions.componentId, salaryComponents.id))).where(eq(salaryComponents.tenantId, tenantId));
    else if (resource === 'structures') data = await db.select({ template: salaryTemplates, version: salaryStructureVersions }).from(salaryTemplates).leftJoin(salaryStructureVersions, and(eq(salaryStructureVersions.tenantId, tenantId), eq(salaryStructureVersions.templateId, salaryTemplates.id))).where(eq(salaryTemplates.tenantId, tenantId));
    else if (resource === 'assignments') data = await db.select({ assignment: employeeSalaryAssignments, employeeName: user.name }).from(employeeSalaryAssignments).innerJoin(user, and(eq(user.id, employeeSalaryAssignments.userId), eq(user.tenantId, tenantId))).where(eq(employeeSalaryAssignments.tenantId, tenantId));
    else if (resource === 'adjustments') data = await db.select().from(payrollAdjustments).where(eq(payrollAdjustments.tenantId, tenantId)).orderBy(desc(payrollAdjustments.createdAt));
    else data = await db.select({ employeeId: employeeProfiles.id, userId: employeeProfiles.userId, employeeCode: employeeProfiles.employeeId, name: user.name }).from(employeeProfiles).leftJoin(user, and(eq(user.id, employeeProfiles.userId), eq(user.tenantId, tenantId))).where(eq(employeeProfiles.tenantId, tenantId));
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { ctx, tenantId } = await gate(request); const body = await parseJson(request, bodySchema);
    let data: unknown;
    if (body.resource === 'settings') {
      const versions = await db.select({ versionNo: payrollSettingsVersions.versionNo }).from(payrollSettingsVersions).where(eq(payrollSettingsVersions.tenantId, tenantId)).orderBy(desc(payrollSettingsVersions.versionNo)).limit(1);
      [data] = await db.insert(payrollSettingsVersions).values({ tenantId, versionNo: (versions[0]?.versionNo ?? 0) + 1, settings: body.settings, status: 'draft' }).returning();
    } else if (body.resource === 'components') {
      if (body.valueType === 'formula' && body.formula) compileFormula(body.formula);
      data = await db.transaction(async tx => {
        const [component] = await tx.insert(salaryComponents).values({ tenantId, name: body.name, type: body.componentType === 'deduction' ? 'deduction' : 'earning', rateType: body.valueType, fixedValue: body.fixedValue ?? null, formulaKey: body.valueType === 'formula' ? body.code : null }).returning();
        if (!component) throw new ApiError(500, 'PAYROLL_COMPONENT_FAILED', 'Création impossible.');
        return (await tx.insert(salaryComponentVersions).values({ tenantId, componentId: component.id, versionNo: 1, code: body.code, name: body.name, componentType: body.componentType, valueType: body.valueType, fixedValue: body.fixedValue ?? null, percentOf: body.percentOf ?? null, percentBp: body.percentBp ?? null, formula: body.formula ?? null, taxable: body.taxable, contributable: body.contributable, side: body.componentType === 'employer' ? 'employer' : body.componentType === 'info' ? 'info' : 'employee', proratable: body.proratable, status: 'draft' }).returning())[0];
      });
    } else if (body.resource === 'structures') {
      data = await db.transaction(async tx => {
        const versions = await tx.select().from(salaryComponentVersions).where(and(eq(salaryComponentVersions.tenantId, tenantId), eq(salaryComponentVersions.status, 'published')));
        const selected = versions.filter(v => body.componentVersionIds.includes(v.id));
        if (selected.length !== body.componentVersionIds.length) throw new ApiError(422, 'PAYROLL_COMPONENT_NOT_PUBLISHED', 'Toutes les composantes doivent être publiées.');
        const [template] = await tx.insert(salaryTemplates).values({ tenantId, name: body.name }).returning();
        const [version] = await tx.insert(salaryStructureVersions).values({ tenantId, templateId: template!.id, versionNo: 1, name: body.name, status: 'draft', effectiveFrom: body.effectiveFrom ?? null }).returning();
        await tx.insert(salaryStructureComponents).values(selected.map((v, i) => ({ tenantId, structureVersionId: version!.id, componentId: v.componentId, componentVersionId: v.id, sortOrder: i })));
        return version;
      });
    } else if (body.resource === 'assignments') {
      const [structure] = await db.select().from(salaryStructureVersions).where(and(eq(salaryStructureVersions.tenantId, tenantId), eq(salaryStructureVersions.id, body.structureVersionId), eq(salaryStructureVersions.status, 'published')));
      if (!structure) throw new ApiError(422, 'PAYROLL_STRUCTURE_NOT_PUBLISHED', 'Structure publiée introuvable.');
      [data] = await db.insert(employeeSalaryAssignments).values({ tenantId, userId: body.userId, templateId: structure.templateId, baseSalary: body.baseSalary, effectiveDate: body.effectiveDate }).returning();
    } else {
      const [employee] = await db.select().from(employeeProfiles).where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.id, body.employeeId), eq(employeeProfiles.userId, body.userId)));
      if (!employee) throw new ApiError(422, 'PAYROLL_EMPLOYEE_NOT_FOUND', 'Employé introuvable.');
      [data] = await db.insert(payrollAdjustments).values({ tenantId, employeeId: body.employeeId, userId: body.userId, adjustmentType: body.adjustmentType, amount: body.amount, reason: body.reason, effectivePeriodYear: body.year, effectivePeriodMonth: body.month, status: 'submitted', requesterId: ctx.userId }).returning();
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
