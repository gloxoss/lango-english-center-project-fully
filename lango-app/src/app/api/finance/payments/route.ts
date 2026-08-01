import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { invoices, payments, user } from '@/models/Schema';

const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'check']),
  referenceId: z.string().trim().max(100).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const rows = await db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        studentId: payments.studentId,
        studentName: user.name,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        referenceId: payments.referenceId,
      })
      .from(payments)
      .innerJoin(user, eq(payments.studentId, user.id))
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.paymentDate))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createPaymentSchema);

    // Fetch target invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La facture indiquée n\'existe pas.');
    }

    const { payment, updatedInvoice } = await db.transaction(async (tx) => {
      // 1. Insert payment record
      const [newPayment] = await tx
        .insert(payments)
        .values({
          tenantId,
          invoiceId: body.invoiceId,
          studentId: invoice.studentId,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          referenceId: body.referenceId || null,
          receivedById: context.userId,
        })
        .returning();

      // 2. Update invoice paidAmount and status
      const newPaidAmount = invoice.paidAmount + body.amount;
      let newStatus: typeof invoice.status = 'partial';
      if (newPaidAmount >= invoice.netAmount) {
        newStatus = 'paid';
      }

      const [inv] = await tx
        .update(invoices)
        .set({
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId)))
        .returning();

      return { payment: newPayment, updatedInvoice: inv };
    });

    recordAudit(context, 'create', 'payment', payment!.id, {
      invoiceId: body.invoiceId,
      amount: body.amount,
      newStatus: updatedInvoice!.status,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment,
        invoice: updatedInvoice,
      },
      message: `Paiement de ${body.amount} MAD enregistré. Statut facture : ${updatedInvoice!.status}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
