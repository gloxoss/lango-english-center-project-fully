import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { moneyToCents } from '@/libs/finance/money';
import { casablancaTodayIso } from '@/libs/finance/today';
import { fineAssessments, finePolicies, invoiceEvents, invoiceItems, invoices, user } from '@/models/Schema';

// GET /api/finance/fine-assessments — assessed fines, tenant-scoped, optionally
// filtered by student or status.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const status = url.searchParams.get('status');

    const conditions = [eq(fineAssessments.tenantId, tenantId)];
    if (studentId) conditions.push(eq(fineAssessments.studentId, studentId));
    if (status) conditions.push(eq(fineAssessments.status, status));
    if (context.branchId) conditions.push(eq(user.branchId, context.branchId));

    const rows = await db
      .select({
        id: fineAssessments.id,
        studentId: fineAssessments.studentId,
        studentName: user.name,
        finePolicyId: fineAssessments.finePolicyId,
        policyName: finePolicies.name,
        invoiceId: fineAssessments.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        amount: fineAssessments.amount,
        reason: fineAssessments.reason,
        status: fineAssessments.status,
        waivedAmount: fineAssessments.waivedAmount,
        waiveReason: fineAssessments.waiveReason,
        assessedAt: fineAssessments.assessedAt,
        supersededById: fineAssessments.supersededById,
        billedLineId: invoiceItems.id,
      })
      .from(fineAssessments)
      .innerJoin(user, and(eq(fineAssessments.studentId, user.id), eq(user.tenantId, tenantId)))
      .leftJoin(finePolicies, and(eq(fineAssessments.finePolicyId, finePolicies.id), eq(finePolicies.tenantId, tenantId)))
      .leftJoin(invoices, and(eq(fineAssessments.invoiceId, invoices.id), eq(invoices.tenantId, tenantId)))
      .leftJoin(invoiceItems, and(eq(invoiceItems.fineAssessmentId, fineAssessments.id), eq(invoiceItems.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(desc(fineAssessments.assessedAt));

    const data = rows.map(row => ({ ...row, billingState: row.supersededById ? 'superseded'
      : row.status === 'waived' ? 'waived' : row.billedLineId ? 'billed' : 'legacy_unbilled' }));
    return NextResponse.json({ success: true, data, total: data.length,
      unbilledCount: data.filter(row => row.billingState === 'legacy_unbilled').length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const waiveSchema = z.object({
  id: z.string().uuid(),
  waiveReason: z.string().trim().min(1).max(1000),
}).strict();

// POST /api/finance/fine-assessments — waive (exonérer) an assessed fine.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, waiveSchema);

    const updated = await db.transaction(async (tx) => {
      const [assessment] = await tx.select().from(fineAssessments)
        .where(and(eq(fineAssessments.id, body.id), eq(fineAssessments.tenantId, tenantId)))
        .for('update').limit(1);
      if (!assessment) throw new ApiError(404, 'FINE_NOT_FOUND', 'Amende introuvable.');
      if (assessment.supersededById) throw new ApiError(409, 'FINE_SUPERSEDED', 'Cette évaluation a déjà été remplacée.');
      if (assessment.status === 'waived') return assessment;
      if (assessment.status !== 'assessed') throw new ApiError(409, 'FINE_NOT_WAIVABLE', 'Cette amende ne peut pas être exonérée.');

      const [line] = await tx.select().from(invoiceItems).where(and(
        eq(invoiceItems.tenantId, tenantId), eq(invoiceItems.fineAssessmentId, assessment.id),
      )).limit(1);
      if (line) {
        const [invoice] = await tx.select().from(invoices).where(and(
          eq(invoices.tenantId, tenantId), eq(invoices.id, line.invoiceId),
          eq(invoices.studentId, assessment.studentId),
        )).for('update').limit(1);
        if (!invoice || invoice.id !== assessment.invoiceId) {
          throw new ApiError(409, 'FINE_INVOICE_MISMATCH', 'La ligne de pénalité ne correspond pas à la facture.');
        }
        const nextNet = moneyToCents(String(invoice.netAmount)) - moneyToCents(String(line.amount));
        const paid = moneyToCents(String(invoice.paidAmount));
        if (nextNet < 0n || paid > nextNet) {
          throw new ApiError(409, 'FINE_REFUND_REQUIRED', 'Remboursez ou créditez le paiement avant d’exonérer cette amende.');
        }
        const status = nextNet === paid ? 'paid'
          : invoice.dueDate < casablancaTodayIso() ? 'overdue'
            : paid > 0n ? 'partial' : 'pending';
        await tx.update(invoices).set({
          discountAmount: sql`${invoices.discountAmount} + ${line.amount}`,
          netAmount: sql`${invoices.netAmount} - ${line.amount}`,
          status,
          updatedAt: new Date().toISOString(),
        }).where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoice.id)));
        await tx.insert(invoiceEvents).values({
          tenantId, invoiceId: invoice.id, eventType: 'fine_waived',
          payload: { fineAssessmentId: assessment.id, amount: line.amount, reason: body.waiveReason },
          actorUserId: context.userId,
        });
      }

      const [result] = await tx.update(fineAssessments).set({
        waivedAmount: assessment.amount,
        waiveReason: body.waiveReason,
        waiveById: context.userId,
        status: 'waived',
      }).where(and(eq(fineAssessments.id, body.id), eq(fineAssessments.tenantId, tenantId))).returning();
      return result!;
    });

    recordAudit(context, 'update', 'fine_assessment', body.id, { action: 'waive', waivedAmount: updated.amount });

    return NextResponse.json({ success: true, data: updated, message: 'Amende exonérée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
