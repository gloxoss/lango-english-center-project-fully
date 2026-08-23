import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { studentCredits } from '@/models/Schema';
import { user } from '@/models/Schema';

// GET /api/finance/credits?studentId= — tenant-scoped student credit balance
// ledger (invoice credits + refund credits).
export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    const conditions = [eq(studentCredits.tenantId, tenantId)];
    if (studentId) conditions.push(eq(studentCredits.studentId, studentId));

    const records = await db
      .select({
        id: studentCredits.id,
        studentId: studentCredits.studentId,
        studentName: user.name,
        amount: studentCredits.amount,
        balance: studentCredits.balance,
        source: studentCredits.source,
        note: studentCredits.note,
        createdById: studentCredits.createdById,
        createdAt: studentCredits.createdAt,
        updatedAt: studentCredits.updatedAt,
      })
      .from(studentCredits)
      .innerJoin(user, eq(studentCredits.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(studentCredits.createdAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
