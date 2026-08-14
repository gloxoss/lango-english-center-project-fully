import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { expenses, user } from '@/models/Schema';

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).optional(),
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

    return NextResponse.json({ success: true, data: newExpense }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
