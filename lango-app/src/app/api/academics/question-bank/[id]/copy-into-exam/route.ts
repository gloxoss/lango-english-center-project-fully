import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { onlineExamQuestionOptions, onlineExamQuestions, onlineExams, questionBankItemOptions, questionBankItems } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const copyIntoExamSchema = z.object({ onlineExamId: z.string().uuid() }).strict();

// Independent-copy model (future-implementation/dropped-features-rebuild,
// discovery decision): the new onlineExamQuestions row has no reference back
// to the bank item - editing the bank original later never changes an exam
// that already used it.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.manage');

    const { id: bankItemId } = await params;
    const body = await parseJson(req, copyIntoExamSchema);

    const [bankItem] = await db.select().from(questionBankItems)
      .where(and(eq(questionBankItems.id, bankItemId), eq(questionBankItems.tenantId, tenantId)))
      .limit(1);
    if (!bankItem) {
      throw new ApiError(404, 'BANK_ITEM_NOT_FOUND', 'Question introuvable dans la banque.');
    }

    const [exam] = await db.select({ id: onlineExams.id }).from(onlineExams)
      .where(and(eq(onlineExams.id, body.onlineExamId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);
    if (!exam) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
    }

    const bankOptions = await db.select().from(questionBankItemOptions).where(eq(questionBankItemOptions.questionBankItemId, bankItemId));

    const result = await db.transaction(async (tx) => {
      const [question] = await tx.insert(onlineExamQuestions).values({
        tenantId,
        onlineExamId: body.onlineExamId,
        questionText: bankItem.questionText,
        marks: String(bankItem.marks),
        sectionLabel: bankItem.sectionLabel,
        difficulty: bankItem.difficulty,
        subjectId: bankItem.subjectId,
        cycle: bankItem.cycle,
      }).returning();

      const options = bankOptions.length > 0
        ? await tx.insert(onlineExamQuestionOptions).values(
            bankOptions.map(o => ({ questionId: question!.id, optionText: o.optionText, isCorrect: o.isCorrect })),
          ).returning()
        : [];

      return { ...question, options };
    });

    recordAudit(ctx, 'create', 'online_exam_question', result.id!, { copiedFromBankItemId: bankItemId });

    return NextResponse.json({ success: true, data: result, message: 'Question copiée dans l\'examen avec succès' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
