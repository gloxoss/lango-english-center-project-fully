import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { invoices, payments, tenants, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const [
      tenantRows,
      studentRows,
      teacherRows,
      parentRows,
      invoiceRows,
      paymentRows,
      monthlyTrendRows,
      paymentMethodRows,
      invoiceStatusRows,
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
        .select({ tenantId: user.tenantId, count: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.role, 'parent'))
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
          count: sql<number>`count(*)::int`,
          collected: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
        })
        .from(payments)
        .where(eq(payments.status, 'posted'))
        .groupBy(payments.tenantId),
      db
        .select({
          month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`,
          collected: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .where(eq(payments.status, 'posted'))
        .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM') ASC`),
      db
        .select({
          method: payments.paymentMethod,
          amount: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .where(eq(payments.status, 'posted'))
        .groupBy(payments.paymentMethod),
      db
        .select({
          status: invoices.status,
          amount: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(invoices)
        .groupBy(invoices.status),
    ]);

    const studentByTenant = new Map(studentRows.map(r => [r.tenantId as string, r.count]));
    const teacherByTenant = new Map(teacherRows.map(r => [r.tenantId as string, r.count]));
    const parentByTenant = new Map(parentRows.map(r => [r.tenantId as string, r.count]));
    const invoiceByTenant = new Map(invoiceRows.map(r => [r.tenantId as string, r]));
    const paymentByTenant = new Map(paymentRows.map(r => [r.tenantId as string, r]));

    const schools = tenantRows.map(t => {
      const invoice = invoiceByTenant.get(t.id);
      const invoiced = invoice?.invoiced ?? 0;
      const payment = paymentByTenant.get(t.id);
      const collected = payment?.collected ?? 0;
      const students = studentByTenant.get(t.id) ?? 0;
      const teachers = teacherByTenant.get(t.id) ?? 0;
      const parents = parentByTenant.get(t.id) ?? 0;

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        planTier: t.planTier,
        subscriptionStatus: t.subscriptionStatus,
        isActive: t.isActive,
        createdAt: t.createdAt,
        students,
        teachers,
        parents,
        studentTeacherRatio: teachers > 0 ? Math.round((students / teachers) * 10) / 10 : students,
        invoicesCount: invoice?.count ?? 0,
        invoiced,
        collected,
        outstanding: Math.max(0, invoiced - collected),
        collectionRate: invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : null,
      };
    });

    const totalStudents = schools.reduce((sum, s) => sum + s.students, 0);
    const totalTeachers = schools.reduce((sum, s) => sum + s.teachers, 0);
    const totalParents = schools.reduce((sum, s) => sum + s.parents, 0);
    const totalInvoiced = schools.reduce((sum, s) => sum + s.invoiced, 0);
    const totalCollected = schools.reduce((sum, s) => sum + s.collected, 0);

    // Formatted payment methods
    const methodLabels: Record<string, string> = {
      cash: 'Espèces',
      check: 'Chèque',
      transfer: 'Virement bancaire',
      card: 'Carte bancaire',
    };

    const paymentMethods = paymentMethodRows.map(pm => ({
      method: pm.method,
      label: methodLabels[pm.method] || pm.method,
      amount: pm.amount,
      count: pm.count,
      percentage: totalCollected > 0 ? Math.round((pm.amount / totalCollected) * 1000) / 10 : 0,
    }));

    // Formatted invoice statuses
    const invoiceStatusLabels: Record<string, string> = {
      paid: 'Payée',
      partial: 'Paiement partiel',
      pending: 'En attente',
      overdue: 'En retard',
      draft: 'Brouillon',
      cancelled: 'Annulée',
    };

    const invoiceStatuses = invoiceStatusRows.map(is => ({
      status: is.status,
      label: invoiceStatusLabels[is.status] || is.status,
      amount: is.amount,
      count: is.count,
    }));

    // Plan distribution
    const planDistribution = {
      trial: schools.filter(s => s.planTier === 'trial').length,
      basic: schools.filter(s => s.planTier === 'basic').length,
      standard: schools.filter(s => s.planTier === 'standard').length,
      premium: schools.filter(s => s.planTier === 'premium').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        totals: {
          schools: schools.length,
          activeSchools: schools.filter(s => s.isActive && s.subscriptionStatus === 'active').length,
          students: totalStudents,
          teachers: totalTeachers,
          parents: totalParents,
          globalRatio: totalTeachers > 0 ? Math.round((totalStudents / totalTeachers) * 10) / 10 : totalStudents,
          invoices: schools.reduce((sum, s) => sum + s.invoicesCount, 0),
          invoiced: totalInvoiced,
          collected: totalCollected,
          outstanding: Math.max(0, totalInvoiced - totalCollected),
          collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 1000) / 10 : null,
          averageFeePerStudent: totalStudents > 0 ? Math.round(totalInvoiced / totalStudents) : 0,
        },
        monthlyTrends: monthlyTrendRows,
        paymentMethods,
        invoiceStatuses,
        planDistribution,
        schools,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

