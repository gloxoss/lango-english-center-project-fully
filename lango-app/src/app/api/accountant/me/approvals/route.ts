import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { decideCreditNote } from '@/libs/services/credit-note-approval';
import { creditNotes, expenses, user } from '@/models/Schema';

const actionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['expense', 'credit_note']),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;

    const [pendingExpenses, pendingCreditNotes] = await Promise.all([
      db
        .select({
          id: expenses.id,
          amount: expenses.amount,
          category: expenses.category,
          expenseDate: expenses.expenseDate,
          description: expenses.description,
          createdAt: expenses.createdAt,
          recordedByName: user.name,
        })
        .from(expenses)
        .leftJoin(user, eq(expenses.recordedById, user.id))
        .where(eq(expenses.tenantId, tenantId))
        .orderBy(desc(expenses.createdAt)),
      db
        .select({
          id: creditNotes.id,
          creditNoteNumber: creditNotes.creditNoteNumber,
          amount: creditNotes.amount,
          reason: creditNotes.reason,
          createdAt: creditNotes.createdAt,
          studentName: user.name,
        })
        .from(creditNotes)
        .leftJoin(user, eq(creditNotes.studentId, user.id))
        .where(and(eq(creditNotes.tenantId, tenantId), eq(creditNotes.status, 'pending')))
        .orderBy(desc(creditNotes.createdAt)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pendingExpenses,
        pendingCreditNotes,
        totalPendingCount: pendingExpenses.length + pendingCreditNotes.length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.approve');

    const tenantId = ctx.tenantId!;
    const body = await parseJson(req, actionSchema);

    if (body.type === 'expense') {
      const [expense] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, body.id), eq(expenses.tenantId, tenantId)))
        .limit(1);

      if (!expense) {
        throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Dépense introuvable.');
      }

      return NextResponse.json({ success: true, data: { ...expense, reviewedAt: new Date().toISOString() } });
    }

    if (body.type === 'credit_note') {
      const updated = await decideCreditNote({
        tenantId,
        id: body.id,
        decision: body.action === 'approve' ? 'approved' : 'rejected',
        decidedById: ctx.userId,
        rejectionReason: body.reason,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    throw new ApiError(400, 'UNSUPPORTED_TYPE', 'Type d\'approbation non supporté.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
