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
import { decideCreditNote } from '@/libs/services/credit-note-approval';
import { creditNotes, invoices, user } from '@/models/Schema';

const createCreditNoteSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().uuid().optional(),
  amount: moneyInput,
  reason: z.string().trim().min(1).max(1000),
}).strict();

const decideCreditNoteSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(
  body => body.decision !== 'rejected' || !!body.rejectionReason,
  { message: 'Un motif est requis pour rejeter une note de crédit.', path: ['rejectionReason'] },
);

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
        status: creditNotes.status,
        approvedById: creditNotes.approvedById,
        approvedAt: creditNotes.approvedAt,
        rejectionReason: creditNotes.rejectionReason,
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
    // Propose: finance.manage (accountant has this). Whether it lands
    // pending or auto-approved depends on whether the creator can also
    // approve - see the auto-approve check below, not a second capability
    // gate on this action.
    await requireCapability(ctx, 'finance.manage');

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

    const canSelfApprove = await hasCapability(ctx.userId, tenantId, ctx.role, 'finance.approve');
    const now = new Date().toISOString();

    const record = await db.transaction(async (tx) => {
      const creditNoteNumber = await consumeDocumentNumber(tx, { tenantId, prefix: `CN-${new Date().getFullYear()}-` });
      const [created] = await tx
        .insert(creditNotes)
        .values({
          tenantId,
          studentId: body.studentId,
          invoiceId: body.invoiceId || null,
          creditNoteNumber,
          amount: normalizeMoney(body.amount),
          reason: body.reason,
          issuedById: ctx.userId,
          status: canSelfApprove ? 'approved' : 'pending',
          approvedById: canSelfApprove ? ctx.userId : null,
          approvedAt: canSelfApprove ? now : null,
        })
        .returning();
      if (!created) {
        throw new ApiError(500, 'CREDIT_NOTE_INSERT_FAILED', 'Note de crédit non enregistrée.');
      }
      return created;
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.approve');
    const body = await parseJson(req, decideCreditNoteSchema);

    const updated = await decideCreditNote({
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
