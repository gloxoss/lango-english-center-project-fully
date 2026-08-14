import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { creditNotes, refunds } from '@/models/Schema';
import { accountingPeriodReopenRequests } from '@/features/accounting/models/accounting-schema';
import { listActiveAuthorities, requireLeadershipScope } from '@/features/leadership/services/scope-service';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const scope = await requireLeadershipScope(ctx);
    const authorities = await listActiveAuthorities(ctx, scope);
    const canSeeFinance = ctx.role === 'school_admin' || authorities.some(a => a.domain === 'finance');

    let finance = null;
    if (canSeeFinance && ctx.tenantId && scope.type === 'tenant') {
      const [credit, refund, reopen] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int`, amount: sql<string>`coalesce(sum(${creditNotes.amount}),0)` }).from(creditNotes)
          .where(and(eq(creditNotes.tenantId, ctx.tenantId), eq(creditNotes.status, 'pending'))),
        db.select({ count: sql<number>`count(*)::int`, amount: sql<string>`coalesce(sum(${refunds.amount}),0)` }).from(refunds)
          .where(and(eq(refunds.tenantId, ctx.tenantId), eq(refunds.status, 'pending'))),
        db.select({ count: sql<number>`count(*)::int` }).from(accountingPeriodReopenRequests)
          .where(and(eq(accountingPeriodReopenRequests.tenantId, ctx.tenantId), eq(accountingPeriodReopenRequests.status, 'pending'))),
      ]);
      finance = {
        pendingCreditNotes: Number(credit[0]?.count ?? 0), pendingCreditNoteAmount: credit[0]?.amount ?? '0',
        pendingRefunds: Number(refund[0]?.count ?? 0), pendingRefundAmount: refund[0]?.amount ?? '0',
        pendingPeriodReopens: Number(reopen[0]?.count ?? 0),
      };
    }

    return NextResponse.json({ success: true, data: { scope, authorities, queues: { finance }, generatedAt: new Date().toISOString() } });
  } catch (error) { return apiErrorResponse(error); }
}
