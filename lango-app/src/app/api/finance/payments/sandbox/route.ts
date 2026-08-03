import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { invoices, payments } from '@/models/Schema';

const sandboxPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['card', 'transfer']).default('card'),
  gateway: z.enum(['cmi_sandbox', 'payzone_sandbox']).default('cmi_sandbox'),
  simulateSuccess: z.boolean().default(true),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, sandboxPaymentSchema);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', 'Facture introuvable.');
    }

    if (!body.simulateSuccess) {
      throw new ApiError(402, 'PAYMENT_FAILED', 'Paiement décliné par la passerelle de test.');
    }

    const refId = `SANDBOX-${body.gateway.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Record payment
    const [newPayment] = await db
      .insert(payments)
      .values({
        tenantId,
        invoiceId: body.invoiceId,
        studentId: invoice.studentId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        referenceId: refId,
        receivedById: context.userId,
      })
      .returning();

    // Calculate total paid for invoice
    const existingPayments = await db
      .select({ amount: payments.amount })
      .from(payments)
      .where(eq(payments.invoiceId, body.invoiceId));

    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const invoiceTotal = Number(invoice.netAmount);
    const newStatus = totalPaid >= invoiceTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

    await db
      .update(invoices)
      .set({
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, body.invoiceId));

    await recordAudit(context, 'create', 'sandbox_payment', newPayment!.id, {
      gateway: body.gateway,
      referenceId: refId,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment: newPayment,
        invoiceStatus: newStatus,
        gatewayResponse: {
          transactionId: refId,
          status: 'SUCCESS',
          code: '00',
          message: 'Paiement bancaire validé (Mode Sandbox).',
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
