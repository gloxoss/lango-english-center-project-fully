import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { paymentMethodConfigurations } from '@/models/Schema';

const methodSchema = z.object({
  methodCode: z.string().trim().min(1).max(50),
  labelFr: z.string().trim().min(1).max(255),
  labelAr: z.string().trim().max(255).optional(),
  requiresReference: z.boolean().optional(),
  requiresBank: z.boolean().optional(),
  requiresDate: z.boolean().optional(),
  requiresProof: z.boolean().optional(),
  refundable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();

// GET /api/finance/payment-methods — configurable payment methods, tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(paymentMethodConfigurations)
      .where(eq(paymentMethodConfigurations.tenantId, tenantId))
      .orderBy(desc(paymentMethodConfigurations.isActive), paymentMethodConfigurations.labelFr);

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/payment-methods — create a payment method configuration.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, methodSchema);

    const [existing] = await db
      .select({ id: paymentMethodConfigurations.id })
      .from(paymentMethodConfigurations)
      .where(and(eq(paymentMethodConfigurations.tenantId, tenantId), eq(paymentMethodConfigurations.methodCode, body.methodCode)))
      .limit(1);
    if (existing) {
      return NextResponse.json({ success: false, message: `Un moyen de paiement '${body.methodCode}' existe déjà.` }, { status: 409 });
    }

    const [inserted] = await db
      .insert(paymentMethodConfigurations)
      .values({
        tenantId,
        methodCode: body.methodCode,
        labelFr: body.labelFr,
        labelAr: body.labelAr ?? null,
        requiresReference: body.requiresReference ?? false,
        requiresBank: body.requiresBank ?? false,
        requiresDate: body.requiresDate ?? false,
        requiresProof: body.requiresProof ?? false,
        refundable: body.refundable ?? true,
        isActive: body.isActive ?? true,
        effectiveFrom: body.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        effectiveTo: body.effectiveTo ?? null,
      })
      .returning();

    recordAudit(context, 'create', 'payment_method', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: `Moyen de paiement '${body.labelFr}' créé.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PUT /api/finance/payment-methods — update a payment method configuration.
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, methodSchema.extend({ id: z.string().uuid() }));

    const [row] = await db
      .select({ id: paymentMethodConfigurations.id })
      .from(paymentMethodConfigurations)
      .where(and(eq(paymentMethodConfigurations.id, body.id), eq(paymentMethodConfigurations.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ success: false, message: 'Moyen de paiement introuvable.' }, { status: 404 });
    }

    const [updated] = await db
      .update(paymentMethodConfigurations)
      .set({
        labelFr: body.labelFr,
        labelAr: body.labelAr ?? null,
        requiresReference: body.requiresReference,
        requiresBank: body.requiresBank,
        requiresDate: body.requiresDate,
        requiresProof: body.requiresProof,
        refundable: body.refundable,
        isActive: body.isActive,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(paymentMethodConfigurations.id, body.id))
      .returning();

    recordAudit(context, 'update', 'payment_method', updated!.id);

    return NextResponse.json({ success: true, data: updated, message: 'Moyen de paiement mis à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
