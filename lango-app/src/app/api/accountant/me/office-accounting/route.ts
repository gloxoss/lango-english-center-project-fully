import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tryPostExpenseGLEntry } from '@/libs/finance/gl-auto-post';
import { expenses, user } from '@/models/Schema';

// Deprecated write path: Office Accounting now uses /api/finance/expenses,
// the canonical expense + double-entry posting pipeline.

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).optional(),
  counterparty: z.string().max(255).optional(),
  expenseAccountId: z.string().uuid().optional(),
  settlementAccountId: z.string().uuid().optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.read');

    const tenantId = ctx.tenantId!;
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get('category');

    const conditions = [eq(expenses.tenantId, tenantId)];
    if (categoryParam && ['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other'].includes(categoryParam)) {
      conditions.push(eq(expenses.category, categoryParam as any));
    }

    const records = await db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        category: expenses.category,
        expenseDate: expenses.expenseDate,
        description: expenses.description,
        receiptUrl: expenses.receiptUrl,
        createdAt: expenses.createdAt,
        recordedByName: user.name,
      })
      .from(expenses)
      .leftJoin(user, eq(expenses.recordedById, user.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));

    const [summary] = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(eq(expenses.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAmount: Number(summary?.totalAmount ?? 0),
          count: Number(summary?.count ?? 0),
        },
        expenses: records,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    await requireCapability(ctx, 'finance.manage');

    const tenantId = ctx.tenantId!;
    const body = await parseJson(req, createExpenseSchema);

    const [newExpense] = await db
      .insert(expenses)
      .values({
        tenantId,
        amount: body.amount,
        category: body.category,
        expenseDate: body.expenseDate,
        description: body.description || body.category,
        recordedById: ctx.userId,
      })
      .returning();

    if (!newExpense) {
      throw new ApiError(500, 'CREATE_EXPENSE_FAILED', 'Impossible de créer la dépense.');
    }

    // Feed the real double-entry ledger: when account references are provided,
    // create an accounting document (draft) so this expense appears in the
    // Plan Comptable and can go through submit → approve → post.
    // When account references are not provided, auto-post directly via default GL accounts (fail-open).
    let accountingDocumentId: string | null = null;
    let glPosted = false;
    if (body.expenseAccountId && body.settlementAccountId) {
      const document = await createAccountingDocument({
        tenantId,
        actorId: ctx.userId,
        documentType: 'expense',
        documentDate: body.expenseDate,
        reference: `OFF-${newExpense.id.slice(0, 8).toUpperCase()}`,
        counterparty: body.counterparty,
        description: body.description || body.category,
        lines: [
          { accountId: body.expenseAccountId, debitAmount: Number(body.amount).toFixed(2), creditAmount: '0', memo: body.description || body.category },
          { accountId: body.settlementAccountId, debitAmount: '0', creditAmount: Number(body.amount).toFixed(2), memo: body.description || body.category },
        ],
      });
      accountingDocumentId = document.id;
    } else {
      const glEntry = await tryPostExpenseGLEntry({
        tenantId,
        actorId: ctx.userId,
        expenseId: newExpense.id,
        description: body.description || body.category,
        amount: String(body.amount),
        expenseDate: body.expenseDate,
      });
      glPosted = glEntry !== null;
    }

    return NextResponse.json({ success: true, data: { ...newExpense, accountingDocumentId, glPosted } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
