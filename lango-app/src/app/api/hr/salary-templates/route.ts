import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { salaryComponents, salaryTemplateComponents, salaryTemplates } from '@/models/Schema';

const componentSchema = z.object({
  id: z.string().uuid().optional(), // omit for new
  name: z.string().min(1).max(100),
  type: z.enum(['earning', 'deduction']),
  rateType: z.enum(['fixed', 'percent', 'formula']),
  fixedValue: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  formulaKey: z.enum(['cnss_employee', 'amo_employee', 'ir', 'cnss_employer', 'amo_employer']).nullable().optional(),
  isStatutory: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  components: z.array(componentSchema).min(1),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.read');
    const tenantId = requireTenant(ctx);

    // Single query: join templates → pivot → components, then group in JS.
    // Avoids N extra round-trips (one per template).
    const rows = await db
      .select({
        templateId: salaryTemplates.id,
        templateName: salaryTemplates.name,
        templateCreatedAt: salaryTemplates.createdAt,
        componentId: salaryComponents.id,
        componentName: salaryComponents.name,
        componentType: salaryComponents.type,
        componentRateType: salaryComponents.rateType,
        componentFixedValue: salaryComponents.fixedValue,
        componentFormulaKey: salaryComponents.formulaKey,
        componentIsStatutory: salaryComponents.isStatutory,
        componentSortOrder: salaryTemplateComponents.sortOrder,
      })
      .from(salaryTemplates)
      .leftJoin(salaryTemplateComponents, eq(salaryTemplateComponents.templateId, salaryTemplates.id))
      .leftJoin(salaryComponents, eq(salaryTemplateComponents.componentId, salaryComponents.id))
      .where(eq(salaryTemplates.tenantId, tenantId));

    // Group flat rows → { template, components[] }
    const templateMap = new Map<string, {
      id: string;
      name: string;
      createdAt: string;
      components: object[];
    }>();

    for (const r of rows) {
      if (!templateMap.has(r.templateId)) {
        templateMap.set(r.templateId, {
          id: r.templateId,
          name: r.templateName,
          createdAt: r.templateCreatedAt,
          components: [],
        });
      }
      if (r.componentId) {
        templateMap.get(r.templateId)!.components.push({
          id: r.componentId,
          name: r.componentName,
          type: r.componentType,
          rateType: r.componentRateType,
          fixedValue: r.componentFixedValue,
          formulaKey: r.componentFormulaKey,
          isStatutory: r.componentIsStatutory,
          sortOrder: r.componentSortOrder,
        });
      }
    }

    return NextResponse.json({ success: true, data: [...templateMap.values()] });
  } catch (err) {
    return apiErrorResponse(err);
  }
}


export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, createTemplateSchema);

    const result = await db.transaction(async (tx) => {
      // Create template
      const [template] = await tx
        .insert(salaryTemplates)
        .values({ tenantId, name: body.name })
        .returning();

      if (!template) {
        throw new ApiError(500, 'INSERT_FAILED', 'Impossible de créer le gabarit salarial.');
      }

      // Upsert components and link to template
      const createdComponents = await Promise.all(
        body.components.map(async (comp, idx) => {
          const [c] = await tx
            .insert(salaryComponents)
            .values({
              tenantId,
              name: comp.name,
              type: comp.type,
              rateType: comp.rateType,
              fixedValue: comp.fixedValue ?? null,
              formulaKey: comp.formulaKey ?? null,
              isStatutory: comp.isStatutory,
            })
            .returning();
          return { component: c!, sortOrder: comp.sortOrder ?? idx };
        }),
      );

      await tx.insert(salaryTemplateComponents).values(
        createdComponents.map(({ component, sortOrder }) => ({
          templateId: template.id,
          componentId: component.id,
          sortOrder,
        })),
      );

      return { template, components: createdComponents.map(c => c.component) };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
