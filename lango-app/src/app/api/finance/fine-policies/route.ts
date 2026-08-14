import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { finePolicies } from '@/models/Schema';

const policySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(1000).optional(),
  scopeClassId: z.string().uuid().nullable().optional(),
  scopeSectionId: z.string().uuid().nullable().optional(),
  graceDays: z.number().int().min(0).optional(),
  formula: z.enum(['flat', 'per_day', 'tiered']).optional(),
  flatAmount: z.number().min(0).optional(),
  perDayAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

// GET /api/finance/fine-policies — active/archived fine policies, tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(finePolicies)
      .where(eq(finePolicies.tenantId, tenantId))
      .orderBy(desc(finePolicies.updatedAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/fine-policies — create a fine policy.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, policySchema);

    const [inserted] = await db
      .insert(finePolicies)
      .values({
        tenantId,
        name: body.name,
        description: body.description ?? null,
        scopeClassId: body.scopeClassId ?? null,
        scopeSectionId: body.scopeSectionId ?? null,
        graceDays: body.graceDays ?? 0,
        formula: body.formula ?? 'flat',
        flatAmount: body.flatAmount ?? 0,
        perDayAmount: body.perDayAmount ?? 0,
        maxAmount: body.maxAmount ?? null,
        effectiveFrom: body.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        effectiveTo: body.effectiveTo ?? null,
        status: body.status ?? 'active',
      })
      .returning();

    recordAudit(context, 'create', 'fine_policy', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: `Politique d'amende '${body.name}' créée.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PUT /api/finance/fine-policies — update a fine policy (prospective edits only).
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, policySchema.extend({ id: z.string().uuid() }));

    const [row] = await db
      .select({ id: finePolicies.id })
      .from(finePolicies)
      .where(and(eq(finePolicies.id, body.id), eq(finePolicies.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ success: false, message: 'Politique d\'amende introuvable.' }, { status: 404 });
    }

    const [updated] = await db
      .update(finePolicies)
      .set({
        name: body.name,
        description: body.description ?? null,
        scopeClassId: body.scopeClassId ?? null,
        scopeSectionId: body.scopeSectionId ?? null,
        graceDays: body.graceDays,
        formula: body.formula,
        flatAmount: body.flatAmount,
        perDayAmount: body.perDayAmount,
        maxAmount: body.maxAmount ?? null,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        status: body.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(finePolicies.id, body.id))
      .returning();

    recordAudit(context, 'update', 'fine_policy', updated!.id);

    return NextResponse.json({ success: true, data: updated, message: 'Politique d\'amende mise à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
