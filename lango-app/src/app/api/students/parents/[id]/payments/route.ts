import type { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { guardianStudents, invoices, payments, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'finance.read');

    const { id: guardianId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

    // Filter students where:
    // 1. Relationship is active (status = 'active')
    // 2. Guardian is explicitly financially responsible (isFinanciallyResponsible = true)
    // 3. Relationship is currently effective (effectiveFrom <= now <= effectiveTo)
    // 4. Student belongs to the viewer's branch if viewer is branch-limited
    const candidateLinks = await db
      .select({
        studentId: guardianStudents.studentId,
        studentName: user.name,
        studentMatricule: user.matricule,
        branchId: user.branchId,
        status: guardianStudents.status,
        effectiveFrom: guardianStudents.effectiveFrom,
        effectiveTo: guardianStudents.effectiveTo,
      })
      .from(guardianStudents)
      .innerJoin(user, eq(guardianStudents.studentId, user.id))
      .where(
        and(
          eq(guardianStudents.guardianId, guardianId),
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.status, 'active'),
          eq(guardianStudents.isFinanciallyResponsible, true),
          ctx.branchId ? eq(user.branchId, ctx.branchId) : undefined,
        ),
      );

    const now = Date.now();
    const financiallyResponsibleLinks = candidateLinks.filter(l => {
      if (l.status !== 'active') return false;
      if (l.effectiveFrom && new Date(l.effectiveFrom).getTime() > now) return false;
      if (l.effectiveTo && new Date(l.effectiveTo).getTime() <= now) return false;
      return true;
    });

    const studentIds = Array.from(new Set(financiallyResponsibleLinks.map(l => l.studentId)));

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        hasFinancialResponsibility: false,
        financiallyResponsibleStudents: [],
        summary: {
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          unpaidInvoicesCount: 0,
          hasFinancialResponsibility: false,
          financiallyResponsibleCount: 0,
        },
      });
    }

    const realInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        studentName: user.name,
        studentMatricule: user.matricule,
        amount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        date: invoices.issueDate,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          inArray(invoices.studentId, studentIds),
        ),
      );

    const realPayments = await db
      .select({
        id: payments.id,
        receiptNumber: payments.referenceId,
        studentId: payments.studentId,
        studentName: user.name,
        studentMatricule: user.matricule,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        date: payments.paymentDate,
      })
      .from(payments)
      .innerJoin(user, eq(payments.studentId, user.id))
      .where(
        and(
          eq(payments.tenantId, tenantId),
          inArray(payments.studentId, studentIds),
        ),
      );

    let totalInvoiced = 0;
    let outstandingBalance = 0;
    let unpaidInvoicesCount = 0;

    for (const inv of realInvoices) {
      if (inv.status !== 'cancelled') {
        const net = Number(inv.amount || 0);
        const paid = Number(inv.paidAmount || 0);
        totalInvoiced += net;
        const due = Math.max(0, net - paid);
        if (due > 0 && inv.status !== 'paid') {
          outstandingBalance += due;
          unpaidInvoicesCount++;
        }
      }
    }

    let totalPaid = 0;
    for (const pay of realPayments) {
      totalPaid += Number(pay.amount || 0);
    }

    const merged = [
      ...realInvoices.map(r => ({
        type: 'invoice' as const,
        id: r.id,
        reference: r.invoiceNumber || `#INV-${r.id.slice(0, 8)}`,
        studentId: r.studentId,
        studentName: r.studentName,
        studentMatricule: r.studentMatricule,
        amount: Number(r.amount || 0),
        status: r.status,
        date: r.date,
      })),
      ...realPayments.map(r => ({
        type: 'payment' as const,
        id: r.id,
        reference: r.receiptNumber || `#REC-${r.id.slice(0, 8)}`,
        studentId: r.studentId,
        studentName: r.studentName,
        studentMatricule: r.studentMatricule,
        amount: Number(r.amount || 0),
        status: r.paymentMethod,
        date: r.date,
      })),
    ]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: merged,
      hasFinancialResponsibility: true,
      financiallyResponsibleStudents: financiallyResponsibleLinks.map(l => ({
        id: l.studentId,
        name: l.studentName,
        matricule: l.studentMatricule,
      })),
      summary: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        unpaidInvoicesCount,
        hasFinancialResponsibility: true,
        financiallyResponsibleCount: financiallyResponsibleLinks.length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
