import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices } from '@/models/Schema';

// PUT /api/finance/invoices/:id/issue — promote a draft to an issued (pending)
// invoice. Drafts are invisible to the collection desk; issue is the act that
// makes a receivable real. Not reversible: posted invoices are never edited.
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
    if (invoice.status !== 'draft') {
      throw new ApiError(409, 'INVOICE_NOT_DRAFT', 'Seule une facture en brouillon peut être émise.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const [updated] = await db
      .update(invoices)
      .set({ status: 'pending', issueDate: today, updatedAt: new Date().toISOString() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    await db.insert(invoiceEvents).values({
      tenantId,
      invoiceId: id,
      eventType: 'issued',
      payload: { invoiceNumber: invoice.invoiceNumber },
      actorUserId: context.userId,
    });
    recordAudit(context, 'update', 'invoice', id, { action: 'issue' });

    return NextResponse.json({ success: true, data: updated, message: `Facture ${invoice.invoiceNumber} émise.` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
