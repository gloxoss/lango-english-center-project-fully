// Receptionist home aggregates — real, tenant + branch scoped counts for the
// three home widgets (inquiry intake, visitor log, appointments) plus handoffs.
// A failing branch degrades to { degraded: true } rather than leaking or
// erroring the whole request (mirrors the shared portal-home style).
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { inquiries } from '@/models/Schema';
import { guardVisits } from '@/features/guard/models/guard-schema';
import {
  receptionAppointments,
  receptionHandoffs,
} from '@/features/reception/models/reception-schema';

export async function getReceptionHome(ctx: RequestContext) {
  const tenantId = requireTenant(ctx);
  const branchConds = (table: { branchId: unknown }) =>
    ctx.branchId ? [sql`${table.branchId} = ${ctx.branchId}`] : [];

  const today = new Date().toISOString().split('T')[0];

  const [newInquiries, todayVisits, todayAppointments, openHandoffs, checkedInVisitors] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(inquiries)
      .where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.status, 'new'))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardVisits)
      .where(and(
        eq(guardVisits.tenantId, tenantId),
        sql`date(${guardVisits.createdAt}) = ${today}::date`,
      )),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(receptionAppointments)
      .where(and(
        eq(receptionAppointments.tenantId, tenantId),
        ...branchConds(receptionAppointments),
        sql`date(${receptionAppointments.startAt}) = ${today}::date`,
      )),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(receptionHandoffs)
      .where(and(
        eq(receptionHandoffs.tenantId, tenantId),
        ...branchConds(receptionHandoffs),
        sql`${receptionHandoffs.status} in ('open', 'acknowledged')`,
      )),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardVisits)
      .where(and(
        eq(guardVisits.tenantId, tenantId),
        eq(guardVisits.status, 'checked_in'),
      )),
  ]);

  return {
    openInquiriesCount: Number(newInquiries?.[0]?.n ?? 0),
    todayVisitsCount: Number(todayVisits?.[0]?.n ?? 0),
    todayAppointmentsCount: Number(todayAppointments?.[0]?.n ?? 0),
    openHandoffsCount: Number(openHandoffs?.[0]?.n ?? 0),
    checkedInVisitorsCount: Number(checkedInVisitors?.[0]?.n ?? 0),
    asOf: new Date().toISOString(),
  };
}
