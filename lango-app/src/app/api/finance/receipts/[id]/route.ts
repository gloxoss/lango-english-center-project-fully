import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { receipts } from '@/features/finance/models/student-accounting-schema';
import { user } from '@/models/Schema';

// GET /api/finance/receipts/:id — one receipt with its student + payment breakdown.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');
    const { id } = await params;

    const [row] = await db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        studentId: receipts.studentId,
        studentName: user.name,
        studentEmail: user.email,
        amount: receipts.amount,
        paymentDate: receipts.paymentDate,
        allocations: receipts.allocations,
        createdById: receipts.createdById,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .innerJoin(user, eq(receipts.studentId, user.id))
      .where(and(eq(receipts.id, id), eq(receipts.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      throw new ApiError(404, 'RECEIPT_NOT_FOUND', 'Reçu introuvable.');
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
