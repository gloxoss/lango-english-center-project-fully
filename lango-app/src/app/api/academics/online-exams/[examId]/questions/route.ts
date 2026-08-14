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

const createQuestionSchema = z.object({
  questionText: z.string().trim().min(1, 'Le texte de la question est requis.').max(2000),
  marks: z.number().positive('Les points doivent être positifs.'),
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

type RouteParams = { params: Promise<{ examId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.read');

    const { examId } = await params;

    // Verify exam belongs to tenant
    const [exam] = await db
      .select({ id: onlineExams.id })
      .from(onlineExams)
      .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);

    if (!exam) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
    }

    const questions = await db
      .select()
      .from(onlineExamQuestions)
      .where(and(eq(onlineExamQuestions.onlineExamId, examId), eq(onlineExamQuestions.tenantId, tenantId)))
      .orderBy(asc(onlineExamQuestions.orderIndex));

    // Load options for all questions
    const questionIds = questions.map(q => q.id);
    const allOptions = questionIds.length > 0
      ? await db
        .select()
        .from(onlineExamQuestionOptions)
        .where(inArray(onlineExamQuestionOptions.questionId, questionIds))
      : [];

    const optionsByQuestion = new Map<string, typeof allOptions>();
    for (const opt of allOptions) {
      const existing = optionsByQuestion.get(opt.questionId) ?? [];
      existing.push(opt);
      optionsByQuestion.set(opt.questionId, existing);
    }

    const result = questions.map(q => ({
      ...q,
      options: optionsByQuestion.get(q.id) ?? [],
    }));

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'grading.manage');

    const { examId } = await params;
    const body = await parseJson(req, createQuestionSchema);

    // Verify exam belongs to tenant
    const [exam] = await db
      .select({ id: onlineExams.id })
      .from(onlineExams)
      .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);

    if (!exam) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
    }

    // Validate MCQ: at least one correct answer required if options provided
    if (body.options && body.options.length > 0) {
      const hasCorrect = body.options.some(o => o.isCorrect);
      if (!hasCorrect) {
        throw new ApiError(422, 'MISSING_CORRECT_ANSWER', 'Au moins une réponse correcte est requise pour les questions à choix multiple.');
      }
    }

    const result = await db.transaction(async (tx) => {
      const [question] = await tx
        .insert(onlineExamQuestions)
        .values({
          tenantId,
          onlineExamId: examId,
          questionText: body.questionText,
          marks: String(body.marks),
          orderIndex: body.orderIndex ?? 0,
          sectionLabel: body.sectionLabel,
          difficulty: body.difficulty,
          subjectId: body.subjectId,
          cycle: body.cycle,
        })
        .returning();

      if (!question) {
        throw new ApiError(500, 'INSERT_FAILED', 'La question n\'a pas pu être créée.');
      }

      const options = body.options && body.options.length > 0
        ? await tx
          .insert(onlineExamQuestionOptions)
          .values(body.options.map(o => ({
            questionId: question.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
          })))
          .returning()
        : [];

      return { ...question, options };
    });

    recordAudit(ctx, 'create', 'online_exam_question', result.id, { examId });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
