import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tryPostRefundGLEntry } from '@/libs/finance/gl-auto-post';
import { normalizeMoney } from '@/libs/finance/money';
import { payments, refunds, user } from '@/models/Schema';

const createRefundSchema = z.object({
  studentId: z.string().min(1),
  paymentId: z.string().uuid(),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0),
  refundMethod: z.enum(['cash', 'card', 'transfer', 'check']).default('cash'),
  reason: z.string().trim().min(1).max(1000),
}).strict();

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
    await requireCapability(ctx, 'finance.approve');

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

    const refundNumber = `REF-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

    const [record] = await db
      .insert(refunds)
      .values({
        tenantId,
        studentId: body.studentId,
        paymentId: body.paymentId,
        refundNumber,
        amount: normalizeMoney(body.amount),
        refundMethod: body.refundMethod,
        reason: body.reason,
        approvedById: ctx.userId,
      })
      .returning();

    // GL auto-posting: fail-open — reversal entry DR AR / CR Cash
    const glEntry = await tryPostRefundGLEntry({
      tenantId,
      actorId: ctx.userId,
      refundId: record!.id,
      refundNumber,
      amount: body.amount,
      refundDate: record!.createdAt,
    });

    return NextResponse.json({ success: true, data: record, glPosted: glEntry !== null }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
