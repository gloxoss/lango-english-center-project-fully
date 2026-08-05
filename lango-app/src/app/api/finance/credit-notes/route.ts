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
import { normalizeMoney } from '@/libs/finance/money';
import { creditNotes, invoices, user } from '@/models/Schema';

const createCreditNoteSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().uuid().optional(),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0),
  reason: z.string().trim().min(1).max(1000),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    const conditions = [eq(creditNotes.tenantId, ctx.tenantId!)];
    if (studentId) {
      conditions.push(eq(creditNotes.studentId, studentId));
    }

    const records = await db
      .select({
        id: creditNotes.id,
        tenantId: creditNotes.tenantId,
        studentId: creditNotes.studentId,
        invoiceId: creditNotes.invoiceId,
        creditNoteNumber: creditNotes.creditNoteNumber,
        amount: creditNotes.amount,
        reason: creditNotes.reason,
        issuedById: creditNotes.issuedById,
        createdAt: creditNotes.createdAt,
        studentName: user.name,
      })
      .from(creditNotes)
      .innerJoin(user, eq(creditNotes.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(creditNotes.createdAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.approve');

    const body = await parseJson(req, createCreditNoteSchema);
    const tenantId = ctx.tenantId!;
    const [student] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student'))).limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_STUDENT', 'Élève invalide pour cet établissement.');
    }
    if (body.invoiceId) {
      const [invoice] = await db.select({ id: invoices.id }).from(invoices).where(and(
        eq(invoices.id, body.invoiceId),
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, body.studentId),
      )).limit(1);
      if (!invoice) {
        throw new ApiError(422, 'INVALID_INVOICE', 'Facture incompatible avec cet élève.');
      }
    }

    const creditNoteNumber = `CN-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

    const [record] = await db
      .insert(creditNotes)
      .values({
        tenantId,
        studentId: body.studentId,
        invoiceId: body.invoiceId || null,
        creditNoteNumber,
        amount: normalizeMoney(body.amount),
        reason: body.reason,
        issuedById: ctx.userId,
      })
      .returning();

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
