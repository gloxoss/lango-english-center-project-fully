import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { invoiceEvents, invoices } from '@/models/Schema';
import { studentCredits } from '@/features/finance/models/student-accounting-schema';

// POST /api/finance/invoices/:id/credit — reverse the outstanding balance of a
// pending/partial invoice into a student credit (source 'invoice_credit'). The
// invoice is marked credited and the receivable closed by the credit. A fully
// paid invoice cannot be credited — the money was received, so only a refund
// (Phase E) is correct. Posted rows are never edited/deleted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .limit(1);
    if (!invoice) {
      throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Facture introuvable.');
    }
    if (invoice.status !== 'pending' && invoice.status !== 'partial') {
      throw new ApiError(409, 'INVOICE_NOT_CREDITABLE', 'Seule une facture en attente ou partiellement réglée peut être créditée.');
    }

    const outstandingCents = moneyToCents(String(invoice.netAmount)) - moneyToCents(String(invoice.paidAmount));

    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({ status: 'credited', updatedAt: new Date().toISOString() })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
      await tx.insert(studentCredits).values({
        tenantId,
        studentId: invoice.studentId,
        amount: Number(centsToMoney(outstandingCents)),
        balance: Number(centsToMoney(outstandingCents)),
        source: 'invoice_credit',
        note: `Crédit facture ${invoice.invoiceNumber}`,
        createdById: context.userId,
      });
      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: id,
        eventType: 'credited',
        payload: { invoiceNumber: invoice.invoiceNumber, creditCents: outstandingCents.toString() },
        actorUserId: context.userId,
      });
    });

    recordAudit(context, 'update', 'invoice', id, { action: 'credit', creditCents: outstandingCents.toString() });

    return NextResponse.json({
      success: true,
      data: { invoiceId: id, invoiceNumber: invoice.invoiceNumber, creditCents: outstandingCents.toString() },
      message: `Facture ${invoice.invoiceNumber} créditée — solde restant reversé au crédit de l'élève.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
