import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { fineAssessments, finePolicies, invoices, user } from '@/models/Schema';

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
      })
      .from(fineAssessments)
      .innerJoin(user, eq(fineAssessments.studentId, user.id))
      .leftJoin(finePolicies, eq(fineAssessments.finePolicyId, finePolicies.id))
      .leftJoin(invoices, eq(fineAssessments.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(fineAssessments.assessedAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
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

    const [assessment] = await db
      .select()
      .from(fineAssessments)
      .where(and(eq(fineAssessments.id, body.id), eq(fineAssessments.tenantId, tenantId)))
      .limit(1);
    if (!assessment) {
      return NextResponse.json({ success: false, message: 'Amende introuvable.' }, { status: 404 });
    }

    const [updated] = await db
      .update(fineAssessments)
      .set({
        waivedAmount: assessment.amount,
        waiveReason: body.waiveReason,
        waiveById: context.userId,
        status: 'waived',
      })
      .where(eq(fineAssessments.id, body.id))
      .returning();

    recordAudit(context, 'update', 'fine_assessment', body.id, { action: 'waive', waivedAmount: assessment.amount });

    return NextResponse.json({ success: true, data: updated, message: 'Amende exonérée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
