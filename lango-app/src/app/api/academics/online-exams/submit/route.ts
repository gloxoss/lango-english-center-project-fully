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

    const now = new Date();
    if (now > new Date(exam.endsAt)) {
      throw new ApiError(422, 'EXAM_EXPIRED', 'Cet examen est expiré.');
    }

    // Real per-attempt deadline: the FIRST time this student's attempt row is
    // written, its startedAt becomes their real recorded start (the upsert
    // below never overwrites startedAt on conflict, so it stays fixed across
    // any later re-submission). A later submission past
    // startedAt + durationMinutes is rejected, even if the exam itself
    // hasn't reached its overall endsAt yet - previously only endsAt was
    // ever checked, so elapsed time per student was never actually
    // measured. future-implementation/assessment-and-examination remediation, section-01.
    const [existingAttempt] = await db
      .select({ startedAt: onlineExamAttempts.startedAt })
      .from(onlineExamAttempts)
      .where(and(eq(onlineExamAttempts.onlineExamId, body.examId), eq(onlineExamAttempts.studentId, context.userId)))
      .limit(1);

    if (existingAttempt) {
      const deadline = new Date(new Date(existingAttempt.startedAt).getTime() + exam.durationMinutes * 60 * 1000);
      if (now > deadline) {
        throw new ApiError(422, 'ATTEMPT_EXPIRED', 'Le temps imparti pour cette tentative est écoulé.');
      }
    }

    const nowIso = now.toISOString();

    const result = await db.transaction(async (tx) => {
      const questions = await tx
        .select()
        .from(onlineExamQuestions)
        .where(eq(onlineExamQuestions.onlineExamId, body.examId));

      const [attempt] = await tx
        .insert(onlineExamAttempts)
        .values({
          tenantId,
          onlineExamId: body.examId,
          studentId: context.userId,
          startedAt: nowIso,
          submittedAt: nowIso,
          status: 'graded',
        })
        .onConflictDoUpdate({
          target: [onlineExamAttempts.onlineExamId, onlineExamAttempts.studentId],
          set: {
            submittedAt: nowIso,
            status: 'graded',
          },
        })
        .returning();

      let totalScore = 0;

      for (const ans of body.answers) {
        const q = questions.find(item => item.id === ans.questionId);
        if (!q) continue;

        // Real ownership check - the option must actually belong to the
        // submitted question, not just exist somewhere in the exam.
        // Previously trusted isCorrect from any option ID, letting a client
        // pair a correct option borrowed from a different question.
        const [opt] = await tx
          .select({ isCorrect: onlineExamQuestionOptions.isCorrect })
          .from(onlineExamQuestionOptions)
          .where(and(eq(onlineExamQuestionOptions.id, ans.selectedOptionId), eq(onlineExamQuestionOptions.questionId, ans.questionId)))
          .limit(1);

        if (opt?.isCorrect) {
          totalScore += Number(q.marks);
        }

        await tx
          .insert(onlineExamAnswers)
          .values({
            attemptId: attempt!.id,
            questionId: ans.questionId,
            selectedOptionId: ans.selectedOptionId,
          });
      }

      const [updatedAttempt] = await tx
        .update(onlineExamAttempts)
        .set({ score: String(totalScore) })
        .where(eq(onlineExamAttempts.id, attempt!.id))
        .returning();

      return updatedAttempt;
    });

    recordAudit(context, 'create', 'online_exam_submission', result!.id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
