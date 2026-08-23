import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices } from '@/models/Schema';

// PUT /api/finance/invoices/:id/cancel — void an issued (pending) invoice that
// has not been paid. A cancelled invoice is excluded from receivables and
// statements. Money already collected cannot be cancelled — a partially/fully
// paid invoice needs a credit/reversal workflow (Phase E).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (invoice.status !== 'pending') {
      throw new ApiError(409, 'INVOICE_NOT_CANCELLABLE', 'Seule une facture émise et non réglée peut être annulée.');
    }

    const [updated] = await db
      .update(invoices)
      .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    await db.insert(invoiceEvents).values({
      tenantId,
      invoiceId: id,
      eventType: 'cancelled',
      payload: { invoiceNumber: invoice.invoiceNumber },
      actorUserId: context.userId,
    });
    recordAudit(context, 'update', 'invoice', id, { action: 'cancel' });

    return NextResponse.json({ success: true, data: updated, message: `Facture ${invoice.invoiceNumber} annulée.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
