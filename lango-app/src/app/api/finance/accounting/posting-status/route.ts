import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { fiscalPeriods, journalEntries, payments, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'accounting.statement.read');
    const [period, unposted] = await Promise.all([
      db.select({ id: fiscalPeriods.id }).from(fiscalPeriods)
        .where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.status, 'open'))).limit(1),
      db.select({
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
      })
        .from(payments)
        .innerJoin(user, and(eq(payments.studentId, user.id), eq(user.tenantId, tenantId)))
        .leftJoin(journalEntries, and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.sourceModule, 'payment'),
          eq(journalEntries.sourceId, payments.id),
          eq(journalEntries.status, 'posted'),
        ))
        .where(and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, 'posted'),
          isNull(journalEntries.id),
          context.branchId ? eq(user.branchId, context.branchId) : undefined,
        )),
    ]);
    return NextResponse.json({ success: true, data: {
      openFiscalPeriod: period.length > 0,
      unpostedPaymentsCount: unposted[0]?.count ?? 0,
      unpostedPaymentsAmount: unposted[0]?.amount ?? 0,
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
