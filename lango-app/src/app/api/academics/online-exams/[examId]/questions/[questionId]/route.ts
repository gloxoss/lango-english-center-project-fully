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
import { onlineExamQuestionOptions, onlineExamQuestions, onlineExams } from '@/models/Schema';

const updateQuestionSchema = z.object({
  questionText: z.string().trim().min(1).max(2000).optional(),
  marks: z.number().positive().optional(),
  orderIndex: z.number().int().min(0).optional(),
  options: z.array(z.object({
    optionText: z.string().trim().min(1),
    isCorrect: z.boolean(),
  })).max(8).optional(),
  sectionLabel: z.string().trim().max(255).optional().nullable(),
  difficulty: z.enum(['facile', 'moyen', 'difficile']).optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  cycle: z.enum(['maternelle', 'primaire', 'college', 'lycee']).optional().nullable(),
}).strict();

type RouteParams = { params: Promise<{ examId: string; questionId: string }> };

/** Verify both exam and question belong to the tenant. */
async function resolveQuestion(tenantId: string, examId: string, questionId: string) {
  const [exam] = await db
    .select({ id: onlineExams.id })
    .from(onlineExams)
    .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
    .limit(1);

  if (!exam) {
    throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
  }

  const [question] = await db
    .select({ id: onlineExamQuestions.id })
    .from(onlineExamQuestions)
    .where(and(
      eq(onlineExamQuestions.id, questionId),
      eq(onlineExamQuestions.onlineExamId, examId),
      eq(onlineExamQuestions.tenantId, tenantId),
    ))
    .limit(1);

  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND', 'Question introuvable.');
  }

  return question;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.manage');

    const { examId, questionId } = await params;
    const body = await parseJson(req, updateQuestionSchema);

    await resolveQuestion(tenantId, examId, questionId);

    // Validate MCQ constraint if options are being replaced
    if (body.options && body.options.length > 0) {
      const hasCorrect = body.options.some(o => o.isCorrect);
      if (!hasCorrect) {
        throw new ApiError(422, 'MISSING_CORRECT_ANSWER', 'Au moins une réponse correcte est requise.');
      }
    }

    const result = await db.transaction(async (tx) => {
      const updateFields: Record<string, unknown> = {};
      if (body.questionText !== undefined) updateFields.questionText = body.questionText;
      if (body.marks !== undefined) updateFields.marks = String(body.marks);
      if (body.orderIndex !== undefined) updateFields.orderIndex = body.orderIndex;
      if (body.sectionLabel !== undefined) updateFields.sectionLabel = body.sectionLabel;
      if (body.difficulty !== undefined) updateFields.difficulty = body.difficulty;
      if (body.subjectId !== undefined) updateFields.subjectId = body.subjectId;
      if (body.cycle !== undefined) updateFields.cycle = body.cycle;

      const [updated] = await tx
        .update(onlineExamQuestions)
        .set(updateFields)
        .where(and(
          eq(onlineExamQuestions.id, questionId),
          eq(onlineExamQuestions.tenantId, tenantId),
        ))
        .returning();

      // Replace options if provided
      let options: { id: string; questionId: string; optionText: string; isCorrect: boolean }[] = [];
      if (body.options !== undefined) {
        await tx
          .delete(onlineExamQuestionOptions)
          .where(eq(onlineExamQuestionOptions.questionId, questionId));

        if (body.options.length > 0) {
          options = await tx
            .insert(onlineExamQuestionOptions)
            .values(body.options.map(o => ({
              questionId,
              optionText: o.optionText,
              isCorrect: o.isCorrect,
            })))
            .returning();
        }
      } else {
        options = await tx
          .select()
          .from(onlineExamQuestionOptions)
          .where(eq(onlineExamQuestionOptions.questionId, questionId));
      }

      return { ...updated, options };
    });

    recordAudit(ctx, 'update', 'online_exam_question', questionId, { examId });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.manage');

    const { examId, questionId } = await params;
    await resolveQuestion(tenantId, examId, questionId);

    // Options cascade-delete via FK onDelete('cascade') on questionId
    await db
      .delete(onlineExamQuestions)
      .where(and(
        eq(onlineExamQuestions.id, questionId),
        eq(onlineExamQuestions.tenantId, tenantId),
      ));

    recordAudit(ctx, 'delete', 'online_exam_question', questionId, { examId });

    return NextResponse.json({ success: true, message: 'Question supprimée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
