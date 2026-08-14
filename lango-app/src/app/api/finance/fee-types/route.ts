import { and, asc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { ApiError } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { feeCategories } from '@/models/Schema';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ attendue.');

const feeTypeSchema = z.object({
  name: z.string().trim().min(1).max(255),
  // description/code are nullable so a PUT can clear them (null) without
  // clobbering them when the field is absent (undefined) - archive sends only
  // { id, isArchived } and must not touch the other columns.
  description: z.string().max(1000).nullable().optional(),
  code: z.string().trim().min(1).max(50).nullable().optional(),
  taxable: z.boolean().optional(),
  refundable: z.boolean().optional(),
  discountable: z.boolean().optional(),
  fineable: z.boolean().optional(),
  revenueAccountId: z.string().uuid().nullable().optional(),
  effectiveFrom: dateInput.optional(),
  effectiveTo: dateInput.nullable().optional(),
  isArchived: z.boolean().optional(),
}).strict();

// PUT is partial: every field except id is optional so an archive call can
// send { id, isArchived } without replaying the full entity.
const feeTypeUpdateSchema = feeTypeSchema.partial().extend({ id: z.string().uuid() });

/** Code is optional, but when present it must be unique within the tenant. */
async function assertCodeAvailable(tenantId: string, code: string | null | undefined, excludeId?: string) {
  if (!code) return;
  const [existing] = await db
    .select({ id: feeCategories.id })
    .from(feeCategories)
    .where(and(eq(feeCategories.tenantId, tenantId), eq(feeCategories.code, code), ...(excludeId ? [ne(feeCategories.id, excludeId)] : [])))
    .limit(1);
  if (existing) {
    throw new ApiError(409, 'FEE_TYPE_CODE_EXISTS', `Un type de frais avec le code '${code}' existe déjà.`);
  }
}

// GET /api/finance/fee-types — fee categories (fee types), tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(feeCategories)
      .where(eq(feeCategories.tenantId, tenantId))
      .orderBy(asc(feeCategories.name));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/fee-types — create a fee type.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, feeTypeSchema);
    await assertCodeAvailable(tenantId, body.code);

    const [inserted] = await db
      .insert(feeCategories)
      .values({
        tenantId,
        name: body.name,
        description: body.description ?? null,
        code: body.code ?? null,
        taxable: body.taxable ?? false,
        refundable: body.refundable ?? true,
        discountable: body.discountable ?? true,
        fineable: body.fineable ?? false,
        revenueAccountId: body.revenueAccountId ?? null,
        effectiveFrom: body.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        effectiveTo: body.effectiveTo ?? null,
      })
      .returning();

    recordAudit(context, 'create', 'fee_category', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: `Type de frais '${body.name}' créé.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PUT /api/finance/fee-types — update a fee type. Never delete: fee types are
// referenced by fee components, so they are renamed/re-described or archived
// (isArchived), not removed.
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, feeTypeUpdateSchema);
    await assertCodeAvailable(tenantId, body.code, body.id);

    const [row] = await db
      .select({ id: feeCategories.id })
      .from(feeCategories)
      .where(and(eq(feeCategories.id, body.id), eq(feeCategories.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ success: false, message: 'Type de frais introuvable.' }, { status: 404 });
    }

    const [updated] = await db
      .update(feeCategories)
      .set({
        name: body.name,
        description: body.description,
        code: body.code,
        taxable: body.taxable,
        refundable: body.refundable,
        discountable: body.discountable,
        fineable: body.fineable,
        revenueAccountId: body.revenueAccountId,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        isArchived: body.isArchived,
      })
      .where(eq(feeCategories.id, body.id))
      .returning();

    recordAudit(context, 'update', 'fee_category', updated!.id);

    return NextResponse.json({ success: true, data: updated, message: body.isArchived ? 'Type de frais archivé.' : 'Type de frais mis à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
