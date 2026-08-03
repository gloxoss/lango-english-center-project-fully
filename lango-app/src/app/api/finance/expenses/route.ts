import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { expenseCreateSchema, expenseUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tryPostExpenseGLEntry } from '@/libs/finance/gl-auto-post';
import { expenses } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(expenses.tenantId, tenantId);

    const rows = await db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.expenseDate))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, expenseCreateSchema);

    const [inserted] = await db
      .insert(expenses)
      .values({
        tenantId,
        category: body.category,
        amount: body.amount,
        expenseDate: body.expenseDate,
        description: body.description,
        receiptUrl: body.receiptUrl,
        recordedById: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'expense', inserted!.id);

    // GL auto-posting: fail-open — skips if CoA not set up or no open fiscal period
    const glEntry = await tryPostExpenseGLEntry({
      tenantId,
      actorId: context.userId,
      expenseId: inserted!.id,
      description: body.description ?? body.category,
      amount: String(body.amount),
      expenseDate: body.expenseDate,
    });

    return NextResponse.json({ success: true, data: inserted, glPosted: glEntry !== null, message: 'Dépense enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, expenseUpdateSchema);

    const [updated] = await db
      .update(expenses)
      .set({
        category: body.category,
        amount: body.amount,
        expenseDate: body.expenseDate,
        description: body.description,
        receiptUrl: body.receiptUrl,
      })
      .where(and(eq(expenses.id, body.id), eq(expenses.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Dépense non trouvée' }, { status: 404 });
    }

    recordAudit(context, 'update', 'expense', body.id);

    return NextResponse.json({ success: true, data: updated, message: 'Dépense mise à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId)));
    recordAudit(context, 'delete', 'expense', id);

    return NextResponse.json({ success: true, message: 'Dépense supprimée', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
