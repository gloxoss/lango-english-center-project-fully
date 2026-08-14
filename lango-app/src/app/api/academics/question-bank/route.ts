import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { questionBankItemOptions, questionBankItems, subjects } from '@/models/Schema';

const createBankItemSchema = z.object({
  questionText: z.string().trim().min(1).max(2000),
  marks: z.number().positive(),
  subjectId: z.string().uuid().optional().nullable(),
  cycle: z.enum(['maternelle', 'primaire', 'college', 'lycee']).optional().nullable(),
  difficulty: z.enum(['facile', 'moyen', 'difficile']).optional().nullable(),
  sectionLabel: z.string().trim().max(255).optional().nullable(),
  options: z.array(z.object({
    optionText: z.string().trim().min(1),
    isCorrect: z.boolean(),
  })).max(8).optional(),
}).strict();

// Real, reusable, exam-independent question bank (future-implementation/
// dropped-features-rebuild) - decoupled from onlineExamQuestions on purpose,
// confirmed by research as a genuine gap, not a relabeling.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.read');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const conditions = [eq(questionBankItems.tenantId, tenantId)];
    const subjectId = searchParams.get('subjectId');
    const cycle = searchParams.get('cycle');
    const difficulty = searchParams.get('difficulty');
    if (subjectId) {
      conditions.push(eq(questionBankItems.subjectId, subjectId));
    }
    if (cycle) {
      conditions.push(eq(questionBankItems.cycle, cycle as 'maternelle' | 'primaire' | 'college' | 'lycee'));
    }
    if (difficulty) {
      conditions.push(eq(questionBankItems.difficulty, difficulty as 'facile' | 'moyen' | 'difficile'));
    }
    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db.select({
        item: questionBankItems,
        subjectName: subjects.name,
      })
        .from(questionBankItems)
        .leftJoin(subjects, eq(questionBankItems.subjectId, subjects.id))
        .where(where)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(questionBankItems).where(where),
    ]);

    // Batched option fetch via a single IN query, not per-item.
    const itemIds = rows.map(r => r.item.id);
    const allOptions = itemIds.length > 0
      ? await db.select().from(questionBankItemOptions).where(inArray(questionBankItemOptions.questionBankItemId, itemIds))
      : [];
    const optionsByItem = new Map<string, typeof allOptions>();
    for (const opt of allOptions) {
      const existing = optionsByItem.get(opt.questionBankItemId) ?? [];
      existing.push(opt);
      optionsByItem.set(opt.questionBankItemId, existing);
    }

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ ...r.item, subjectName: r.subjectName, options: optionsByItem.get(r.item.id) ?? [] })),
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createBankItemSchema);

    if (body.options && body.options.length > 0) {
      const hasCorrect = body.options.some(o => o.isCorrect);
      if (!hasCorrect) {
        throw new ApiError(422, 'MISSING_CORRECT_ANSWER', 'Au moins une réponse correcte est requise pour les questions à choix multiple.');
      }
    }

    const result = await db.transaction(async (tx) => {
      const [item] = await tx.insert(questionBankItems).values({
        tenantId,
        questionText: body.questionText,
        marks: body.marks,
        subjectId: body.subjectId,
        cycle: body.cycle,
        difficulty: body.difficulty,
        sectionLabel: body.sectionLabel,
        createdById: context.userId,
      }).returning();

      const options = body.options && body.options.length > 0
        ? await tx.insert(questionBankItemOptions).values(
            body.options.map(o => ({ questionBankItemId: item!.id, optionText: o.optionText, isCorrect: o.isCorrect })),
          ).returning()
        : [];

      return { ...item, options };
    });

    recordAudit(context, 'create', 'question_bank_item', result.id!);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    // Safe to delete unconditionally - copies made via copy-into-exam are
    // fully independent rows with no FK back to the bank item.
    await db.delete(questionBankItems).where(and(eq(questionBankItems.id, id), eq(questionBankItems.tenantId, tenantId)));
    recordAudit(context, 'delete', 'question_bank_item', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
