import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { onlineExamAnswers, onlineExamAttempts, onlineExamQuestionOptions, onlineExamQuestions, onlineExams } from '@/models/Schema';

const submitExamSchema = z.object({
  examId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionId: z.string().uuid(),
  })),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, submitExamSchema);

    const [exam] = await db
      .select()
      .from(onlineExams)
      .where(and(eq(onlineExams.id, body.examId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);

    if (!exam) {
      throw new ApiError(404, 'NOT_FOUND', 'Examen introuvable.');
    }

    const now = new Date().toISOString();
    if (new Date(now) > new Date(exam.endsAt)) {
      throw new ApiError(422, 'EXAM_EXPIRED', 'Cet examen est expiré.');
    }

    // Fetch all questions and options for this exam
    const questions = await db
      .select()
      .from(onlineExamQuestions)
      .where(eq(onlineExamQuestions.onlineExamId, body.examId));

    let totalScore = 0;

    // Create attempt
    const [attempt] = await db
      .insert(onlineExamAttempts)
      .values({
        tenantId,
        onlineExamId: body.examId,
        studentId: context.userId,
        startedAt: now,
        submittedAt: now,
        status: 'graded',
      })
      .onConflictDoUpdate({
        target: [onlineExamAttempts.onlineExamId, onlineExamAttempts.studentId],
        set: {
          submittedAt: now,
          status: 'graded',
        },
      })
      .returning();

    // Process answers & compute score
    for (const ans of body.answers) {
      const q = questions.find(item => item.id === ans.questionId);
      if (!q) continue;

      const [opt] = await db
        .select({ isCorrect: onlineExamQuestionOptions.isCorrect })
        .from(onlineExamQuestionOptions)
        .where(eq(onlineExamQuestionOptions.id, ans.selectedOptionId))
        .limit(1);

      if (opt?.isCorrect) {
        totalScore += Number(q.marks);
      }

      await db
        .insert(onlineExamAnswers)
        .values({
          attemptId: attempt!.id,
          questionId: ans.questionId,
          selectedOptionId: ans.selectedOptionId,
        });
    }

    // Save final score
    const [updatedAttempt] = await db
      .update(onlineExamAttempts)
      .set({ score: String(totalScore) })
      .where(eq(onlineExamAttempts.id, attempt!.id))
      .returning();

    await recordAudit(context, 'create', 'online_exam_submission', attempt!.id);

    return NextResponse.json({
      success: true,
      data: updatedAttempt,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
