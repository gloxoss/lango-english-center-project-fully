import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { normalizeMoney } from '@/libs/finance/money';
import { invoiceItems, invoices, paymentAllocations, payments } from '@/models/Schema';

const createAllocationSchema = z.object({
  paymentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  invoiceItemId: z.string().uuid().optional(),
  allocatedAmount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');
    const invoiceId = searchParams.get('invoiceId');

    const conditions = [eq(paymentAllocations.tenantId, ctx.tenantId!)];
    if (paymentId) {
      conditions.push(eq(paymentAllocations.paymentId, paymentId));
    }
    if (invoiceId) {
      conditions.push(eq(paymentAllocations.invoiceId, invoiceId));
    }

    const allocations = await db
      .select({
        id: paymentAllocations.id,
        tenantId: paymentAllocations.tenantId,
        paymentId: paymentAllocations.paymentId,
        invoiceId: paymentAllocations.invoiceId,
        invoiceItemId: paymentAllocations.invoiceItemId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        createdAt: paymentAllocations.createdAt,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(paymentAllocations)
      .innerJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(paymentAllocations.createdAt));

    return NextResponse.json({ success: true, data: allocations });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.manage');

    const body = await parseJson(req, createAllocationSchema);
    const tenantId = ctx.tenantId!;
    const allocation = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${body.paymentId}:${body.invoiceId}`}, 0))`);
      const [payment] = await tx.select({ id: payments.id, studentId: payments.studentId }).from(payments).where(and(eq(payments.id, body.paymentId), eq(payments.tenantId, tenantId))).limit(1);
      const [invoice] = await tx.select({ id: invoices.id, studentId: invoices.studentId }).from(invoices).where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
      if (!payment || !invoice || payment.studentId !== invoice.studentId) {
        throw new ApiError(422, 'INVALID_ALLOCATION_REFERENCE', 'Le paiement et la facture doivent appartenir au même élève et établissement.');
      }
      if (body.invoiceItemId) {
        const [item] = await tx.select({ id: invoiceItems.id }).from(invoiceItems).where(and(eq(invoiceItems.id, body.invoiceItemId), eq(invoiceItems.invoiceId, body.invoiceId))).limit(1);
        if (!item) {
          throw new ApiError(422, 'INVALID_INVOICE_ITEM', 'La ligne de facture ne correspond pas à cette facture.');
        }
      }
      const [created] = await tx.insert(paymentAllocations).values({
        tenantId,
        paymentId: body.paymentId,
        invoiceId: body.invoiceId,
        invoiceItemId: body.invoiceItemId || null,
        allocatedAmount: normalizeMoney(body.allocatedAmount),
      }).returning();
      if (!created) {
        throw new ApiError(500, 'ALLOCATION_INSERT_FAILED', 'Allocation non enregistrée.');
      }
      return created;
    });

    return NextResponse.json({ success: true, data: allocation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
