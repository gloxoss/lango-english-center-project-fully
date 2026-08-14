import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices } from '@/models/Schema';

// GET /api/finance/invoice-events?invoiceId=... — immutable event ledger for one
// invoice, tenant-scoped. Requires a single invoiceId.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const invoiceId = new URL(request.url).searchParams.get('invoiceId');
    if (!invoiceId) {
      return NextResponse.json({ success: false, message: 'Paramètre invoiceId requis.' }, { status: 422 });
    }

    const [invoice] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Facture introuvable.' }, { status: 404 });
    }

    const events = await db
      .select()
      .from(invoiceEvents)
      .where(and(eq(invoiceEvents.tenantId, tenantId), eq(invoiceEvents.invoiceId, invoiceId)))
      .orderBy(asc(invoiceEvents.createdAt));

    return NextResponse.json({ success: true, data: { invoice, events }, total: events.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
