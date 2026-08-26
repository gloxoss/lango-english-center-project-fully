import { and, asc, eq, inArray } from 'drizzle-orm';
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

type RouteParams = { params: Promise<{ examId: string }> };

const variantsSchema = z.object({
  count: z.number().int().min(1).max(20).default(2),
}).strict();

// Fisher-Yates shuffle (in-place copy) - deterministic enough for UI feedback,
// random enough that each variant differs in question and QCM option order.
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// Generates N variants of an existing exam. Each variant is its own onlineExam
// row sharing the source's metadata, with the same questions re-inserted in a
// randomized order and each QCM's options re-ordered (independent-copy model,
// same as copy-into-exam - editing the source never mutates a variant).
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.manage');

    const { examId } = await params;
    const body = await parseJson(req, variantsSchema);

    const [source] = await db
      .select()
      .from(onlineExams)
      .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);

    if (!source) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
    }

    const sourceQuestions = await db
      .select()
      .from(onlineExamQuestions)
      .where(and(eq(onlineExamQuestions.onlineExamId, examId), eq(onlineExamQuestions.tenantId, tenantId)))
      .orderBy(asc(onlineExamQuestions.orderIndex));

    if (sourceQuestions.length === 0) {
      throw new ApiError(422, 'NO_QUESTIONS', 'L\'examen source ne contient aucune question à dupliquer.');
    }

    const questionIds = sourceQuestions.map(q => q.id);
    const allOptions = await db
      .select()
      .from(onlineExamQuestionOptions)
      .where(inArray(onlineExamQuestionOptions.questionId, questionIds));

    const optionsByQuestion = new Map<string, typeof allOptions>();
    for (const opt of allOptions) {
      const existing = optionsByQuestion.get(opt.questionId) ?? [];
      existing.push(opt);
      optionsByQuestion.set(opt.questionId, existing);
    }

    const variants = await db.transaction(async (tx) => {
      const created: { id: string; title: string; questionsCount: number }[] = [];

      for (let i = 0; i < body.count; i++) {
        const [variant] = await tx
          .insert(onlineExams)
          .values({
            tenantId,
            classSubjectId: source.classSubjectId,
            title: `${source.title} — Variante ${i + 1}`,
            durationMinutes: source.durationMinutes,
            totalMarks: source.totalMarks,
            startsAt: source.startsAt,
            endsAt: source.endsAt,
            createdById: ctx.userId,
          })
          .returning();

        if (!variant) {
          throw new ApiError(500, 'INSERT_FAILED', 'Une variante n\'a pas pu être créée.');
        }

        const shuffledQuestions = shuffle(sourceQuestions);

        for (let orderIndex = 0; orderIndex < shuffledQuestions.length; orderIndex++) {
          const q = shuffledQuestions[orderIndex]!;
          const [question] = await tx
            .insert(onlineExamQuestions)
            .values({
              tenantId,
              onlineExamId: variant.id,
              questionText: q.questionText,
              marks: q.marks,
              orderIndex,
              sectionLabel: q.sectionLabel,
              difficulty: q.difficulty,
              subjectId: q.subjectId,
              cycle: q.cycle,
            })
            .returning();

          const options = optionsByQuestion.get(q.id) ?? [];
          if (options.length > 0 && question) {
            const shuffledOptions = shuffle(options);
            await tx.insert(onlineExamQuestionOptions).values(
              shuffledOptions.map(o => ({
                questionId: question.id,
                optionText: o.optionText,
                isCorrect: o.isCorrect,
              })),
            );
          }
        }

        created.push({ id: variant.id, title: variant.title, questionsCount: shuffledQuestions.length });
      }

      return created;
    });

    for (const v of variants) {
      recordAudit(ctx, 'create', 'online_exam', v.id, { variantsOf: examId });
    }

    return NextResponse.json({ success: true, data: variants, total: variants.length }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
