import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { invoices, payments, tenants, user } from '@/models/Schema';

// GET /api/super-admin/reports - aggregated cross-school statistics. A single
// per-tenant roll-up (students, teachers, invoices, revenue) plus platform
// totals, so the "Rapports Plateforme" page renders real numbers, not mocks.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const [
      tenantRows,
      studentRows,
      teacherRows,
      invoiceRows,
      paymentRows,
    ] = await Promise.all([
      db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          planTier: tenants.planTier,
          subscriptionStatus: tenants.subscriptionStatus,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt,
        })
        .from(tenants),
      db
        .select({ tenantId: user.tenantId, count: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.role, 'student'))
        .groupBy(user.tenantId),
      db
        .select({ tenantId: user.tenantId, count: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.role, 'teacher'))
        .groupBy(user.tenantId),
      db
        .select({
          tenantId: invoices.tenantId,
          count: sql<number>`count(*)::int`,
          invoiced: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
        })
        .from(invoices)
        .groupBy(invoices.tenantId),
      db
        .select({
          tenantId: payments.tenantId,
          collected: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
        })
        .from(payments)
        .groupBy(payments.tenantId),
    ]);

    const studentByTenant = new Map(studentRows.map(r => [r.tenantId as string, r.count]));
    const teacherByTenant = new Map(teacherRows.map(r => [r.tenantId as string, r.count]));
    const invoiceByTenant = new Map(invoiceRows.map(r => [r.tenantId as string, r]));
    const paymentByTenant = new Map(paymentRows.map(r => [r.tenantId as string, r.collected]));

    const schools = tenantRows.map(t => {
      const invoice = invoiceByTenant.get(t.id);
      const invoiced = invoice?.invoiced ?? 0;
      const collected = paymentByTenant.get(t.id) ?? 0;
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        planTier: t.planTier,
        subscriptionStatus: t.subscriptionStatus,
        isActive: t.isActive,
        createdAt: t.createdAt,
        students: studentByTenant.get(t.id) ?? 0,
        teachers: teacherByTenant.get(t.id) ?? 0,
        invoicesCount: invoice?.count ?? 0,
        invoiced,
        collected,
        outstanding: Math.max(0, invoiced - collected),
        collectionRate: invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : null,
      };
    });

    const totalStudents = schools.reduce((sum, s) => sum + s.students, 0);
    const totalTeachers = schools.reduce((sum, s) => sum + s.teachers, 0);
    const totalInvoiced = schools.reduce((sum, s) => sum + s.invoiced, 0);
    const totalCollected = schools.reduce((sum, s) => sum + s.collected, 0);

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        totals: {
          schools: schools.length,
          activeSchools: schools.filter(s => s.isActive && s.subscriptionStatus === 'active').length,
          students: totalStudents,
          teachers: totalTeachers,
          invoices: schools.reduce((sum, s) => sum + s.invoicesCount, 0),
          invoiced: totalInvoiced,
          collected: totalCollected,
          outstanding: Math.max(0, totalInvoiced - totalCollected),
          collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 1000) / 10 : null,
        },
        schools,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
