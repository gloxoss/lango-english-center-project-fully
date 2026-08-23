import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { consumeDocumentNumber } from '@/libs/finance/document-number';
import { normalizeMoney } from '@/libs/finance/money';
import { moneyInput } from '@/libs/finance/validation';
import { applyApprovedRefund, decideRefund } from '@/libs/services/refund-approval';
import { payments, refunds, user } from '@/models/Schema';

const createRefundSchema = z.object({
  studentId: z.string().min(1),
  paymentId: z.string().uuid(),
  amount: moneyInput,
  refundMethod: z.enum(['cash', 'card', 'transfer', 'check']).default('cash'),
  reason: z.string().trim().min(1).max(1000),
}).strict();

const decideRefundSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(
  body => body.decision !== 'rejected' || !!body.rejectionReason,
  { message: 'Un motif est requis pour rejeter un remboursement.', path: ['rejectionReason'] },
);

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    const conditions = [eq(refunds.tenantId, ctx.tenantId!)];
    if (studentId) {
      conditions.push(eq(refunds.studentId, studentId));
    }

    const records = await db
      .select({
        id: refunds.id,
        tenantId: refunds.tenantId,
        studentId: refunds.studentId,
        paymentId: refunds.paymentId,
        refundNumber: refunds.refundNumber,
        amount: refunds.amount,
        refundMethod: refunds.refundMethod,
        reason: refunds.reason,
        approvedById: refunds.approvedById,
        createdAt: refunds.createdAt,
        status: refunds.status,
        decidedById: refunds.decidedById,
        decidedAt: refunds.decidedAt,
        rejectionReason: refunds.rejectionReason,
        studentName: user.name,
      })
      .from(refunds)
      .innerJoin(user, eq(refunds.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(refunds.createdAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    // Propose: finance.manage (accountant has this). Whether it lands
    // pending or auto-approved depends on whether the creator can also
    // approve - same pattern as credit notes, not a second capability gate.
    await requireCapability(ctx, 'finance.manage');

    const body = await parseJson(req, createRefundSchema);
    const tenantId = ctx.tenantId!;
    const [payment] = await db.select({ id: payments.id }).from(payments).where(and(
      eq(payments.id, body.paymentId),
      eq(payments.tenantId, tenantId),
      eq(payments.studentId, body.studentId),
    )).limit(1);
    if (!payment) {
      throw new ApiError(422, 'INVALID_PAYMENT', 'Le paiement original est incompatible avec cet élève.');
    }

    const canSelfApprove = await hasCapability(ctx.userId, tenantId, ctx.role, 'finance.approve');
    const now = new Date().toISOString();

    const { record } = await db.transaction(async (tx) => {
      const number = await consumeDocumentNumber(tx, { tenantId, prefix: `RF-${new Date().getFullYear()}-` });
      const [created] = await tx
        .insert(refunds)
        .values({
          tenantId,
          studentId: body.studentId,
          paymentId: body.paymentId,
          refundNumber: number,
          amount: normalizeMoney(body.amount),
          refundMethod: body.refundMethod,
          reason: body.reason,
          approvedById: ctx.userId,
          status: canSelfApprove ? 'approved' : 'pending',
          decidedById: canSelfApprove ? ctx.userId : null,
          decidedAt: canSelfApprove ? now : null,
        })
        .returning();
      if (!created) {
        throw new ApiError(500, 'REFUND_INSERT_FAILED', 'Remboursement non enregistré.');
      }
      return { record: created };
    });

    // GL auto-posting + ledger linkage only once a refund is actually approved -
    // a pending request hasn't happened yet, nothing should hit the ledger for it.
    let glPosted = false;
    if (canSelfApprove) {
      const glEntry = await applyApprovedRefund({
        tenantId,
        actorId: ctx.userId,
        refund: record,
      });
      glPosted = glEntry !== null;
    }

    return NextResponse.json({ success: true, data: record, glPosted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.approve');
    const body = await parseJson(req, decideRefundSchema);

    const updated = await decideRefund({
      tenantId: ctx.tenantId!,
      id: body.id,
      decision: body.decision,
      decidedById: ctx.userId,
      rejectionReason: body.rejectionReason,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
