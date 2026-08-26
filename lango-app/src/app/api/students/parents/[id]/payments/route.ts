import { and, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { guardianStudents, invoices, payments, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

// Household payment history: aggregates invoices+payments across every
// student linked to this guardian (future-implementation/dropped-features-
// rebuild). Two batched inArray() queries, not a per-student loop - fixed
// during Phase 4 review to avoid N+1.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    // Household invoice/payment amounts are billing data, not guardian
    // contact info - finance.read is the correct gate here (guardians.read
    // would let e.g. a teacher see another family's payment history).
    await requireCapability(ctx, 'finance.read');

    const { id: guardianId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

    const links = await db
      .select({ studentId: guardianStudents.studentId })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.tenantId, tenantId)));

    const studentIds = links.map(l => l.studentId);
    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const realInvoices = await db
      .select({
        id: invoices.id,
        studentId: invoices.studentId,
        studentName: user.name,
        amount: invoices.netAmount,
        status: invoices.status,
        date: invoices.issueDate,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.studentId, studentIds)));

    const realPayments = await db
      .select({
        id: payments.id,
        studentId: payments.studentId,
        studentName: user.name,
        amount: payments.amount,
        status: payments.paymentMethod,
        date: payments.paymentDate,
      })
      .from(payments)
      .innerJoin(user, eq(payments.studentId, user.id))
      .where(and(eq(payments.tenantId, tenantId), inArray(payments.studentId, studentIds)));

    const merged = [
      ...realInvoices.map(r => ({ type: 'invoice' as const, ...r })),
      ...realPayments.map(r => ({ type: 'payment' as const, ...r })),
    ]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
