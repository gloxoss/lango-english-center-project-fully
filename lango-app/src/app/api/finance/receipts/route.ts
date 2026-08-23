import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { receipts } from '@/features/finance/models/student-accounting-schema';
import { user } from '@/models/Schema';

const studentAlias = alias(user, 'student');
const cashierAlias = alias(user, 'cashier');

// GET /api/finance/receipts — tenant-scoped list of persisted receipts.
// A receipt is the immutable proof of a collection; it always exists because it
// is created inside the same transaction as its payment (see receipt.ts).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    const rows = await db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        studentId: receipts.studentId,
        studentName: studentAlias.name,
        amount: receipts.amount,
        paymentDate: receipts.paymentDate,
        allocations: receipts.allocations,
        receivedByName: cashierAlias.name,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .innerJoin(studentAlias, eq(receipts.studentId, studentAlias.id))
      .leftJoin(cashierAlias, eq(receipts.createdById, cashierAlias.id))
      .where(studentId ? and(eq(receipts.tenantId, tenantId), eq(receipts.studentId, studentId)) : eq(receipts.tenantId, tenantId))
      .orderBy(desc(receipts.createdAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
