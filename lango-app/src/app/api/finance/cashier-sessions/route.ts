import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { cashierSessions, user } from '@/models/Schema';

// GET /api/finance/cashier-sessions?cashierId=&status= — tenant-scoped session
// history for the Sessions de caisse screen.
export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const { searchParams } = new URL(req.url);
    const cashierId = searchParams.get('cashierId');
    const status = searchParams.get('status');

    const conditions = [eq(cashierSessions.tenantId, tenantId)];
    if (cashierId) conditions.push(eq(cashierSessions.cashierId, cashierId));
    if (status === 'open' || status === 'closed' || status === 'reconciled') {
      conditions.push(eq(cashierSessions.status, status));
    }

    const records = await db
      .select({
        id: cashierSessions.id,
        cashierId: cashierSessions.cashierId,
        cashierName: user.name,
        openedAt: cashierSessions.openedAt,
        closedAt: cashierSessions.closedAt,
        startingFloat: cashierSessions.startingFloat,
        expectedCash: cashierSessions.expectedCash,
        actualCash: cashierSessions.actualCash,
        totalCollected: cashierSessions.totalCollected,
        status: cashierSessions.status,
        notes: cashierSessions.notes,
        reconciledAt: cashierSessions.reconciledAt,
        createdAt: cashierSessions.createdAt,
      })
      .from(cashierSessions)
      .innerJoin(user, eq(cashierSessions.cashierId, user.id))
      .where(and(...conditions))
      .orderBy(desc(cashierSessions.openedAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
