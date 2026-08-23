import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoices, paymentAllocations } from '@/models/Schema';

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

// Deprecated since Phase D (plan #12): payment allocations are created inline
// by POST /api/finance/payments via its allocations[] body — a manual
// allocate-after-the-fact endpoint invites unallocated/unbalanced collections.
// The route stays as a 410 so old callers get an explicit, actionable signal.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'GONE',
        message: 'Les allocations de paiement se font désormais via POST /api/finance/payments (allocations[]). Cette route est supprimée.',
      },
    },
    { status: 410 },
  );
}
