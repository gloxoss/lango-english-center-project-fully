import { and, asc, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classSections,
  classSubjects,
  onlineExamAttempts,
  onlineExamQuestionOptions,
  onlineExamQuestions,
  onlineExams,
  user,
} from '@/models/Schema';

// Student exam-taking view (security audit P0-B / P1-D).
//
// The authoring route ([examId]/questions) returns isCorrect on every option —
// the full answer key — and used to be reachable by students and parents. This
// route is the only student-facing way to read exam questions:
//   - student role only,
//   - only between startsAt and endsAt,
//   - only for students placed in a section of the exam's class,
//   - isCorrect is NEVER included,
//   - opening the exam records the attempt's startedAt (once), so the
//     per-student timer starts when the student OPENS the exam, not at their
//     first submit.

type RouteParams = { params: Promise<{ examId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['student']);
    const tenantId = requireTenant(ctx);
    const { examId } = await params;

    const [exam] = await db
      .select()
      .from(onlineExams)
      .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
      .limit(1);

    if (!exam) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
    }

    // Window check: the exam must be open.
    const now = new Date();
    const nowIso = now.toISOString();
    if (now < new Date(exam.startsAt)) {
      throw new ApiError(422, 'EXAM_NOT_OPEN', 'Cet examen n\'est pas encore ouvert.');
    }
    if (now > new Date(exam.endsAt)) {
      throw new ApiError(422, 'EXAM_EXPIRED', 'Cet examen est expiré.');
    }

    // Enrollment check: the student must be placed in a section of the exam's class.
    const [studentRow] = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, ctx.userId), eq(user.tenantId, tenantId)))
      .limit(1);
    const studentSectionId = studentRow?.classSectionId ?? null;
    if (!studentSectionId) {
      throw new ApiError(403, 'EXAM_NOT_ASSIGNED', 'Aucune classe attribuée : cet examen ne vous est pas destiné.');
    }

    const [enrollment] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .innerJoin(
        classSubjects,
        and(eq(classSubjects.classId, classSections.classId), eq(classSubjects.tenantId, tenantId)),
      )
      .where(and(
        eq(classSections.id, studentSectionId),
        eq(classSections.tenantId, tenantId),
        eq(classSubjects.id, exam.classSubjectId),
      ))
      .limit(1);

    if (!enrollment) {
      throw new ApiError(403, 'EXAM_NOT_ASSIGNED', 'Cet examen ne concerne pas votre classe.');
    }

    // Open the attempt: the FIRST open records startedAt (never overwritten),
    // so the per-student timer starts here. Re-opening later keeps the
    // original start.
    await db
      .insert(onlineExamAttempts)
      .values({
        tenantId,
        onlineExamId: examId,
        studentId: ctx.userId,
        startedAt: nowIso,
        status: 'in_progress',
      })
      .onConflictDoNothing({ target: [onlineExamAttempts.onlineExamId, onlineExamAttempts.studentId] });

    const [attempt] = await db
      .select({ startedAt: onlineExamAttempts.startedAt, submittedAt: onlineExamAttempts.submittedAt, status: onlineExamAttempts.status })
      .from(onlineExamAttempts)
      .where(and(eq(onlineExamAttempts.onlineExamId, examId), eq(onlineExamAttempts.studentId, ctx.userId)))
      .limit(1);

    if (!attempt) {
      throw new ApiError(500, 'ATTEMPT_INIT_FAILED', 'Impossible d\'initialiser la tentative.');
    }
    if (attempt.submittedAt) {
      throw new ApiError(422, 'ATTEMPT_ALREADY_SUBMITTED', 'Vous avez déjà soumis cet examen.');
    }

    const deadline = new Date(new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60 * 1000);
    if (now > deadline) {
      throw new ApiError(422, 'ATTEMPT_EXPIRED', 'Le temps imparti pour cette tentative est écoulé.');
    }

    // Questions WITHOUT the answer key: options are projected explicitly so a
    // future schema change cannot silently re-expose isCorrect.
    const questions = await db
      .select({
        id: onlineExamQuestions.id,
        questionText: onlineExamQuestions.questionText,
        marks: onlineExamQuestions.marks,
        orderIndex: onlineExamQuestions.orderIndex,
        sectionLabel: onlineExamQuestions.sectionLabel,
        difficulty: onlineExamQuestions.difficulty,
      })
      .from(onlineExamQuestions)
      .where(and(eq(onlineExamQuestions.onlineExamId, examId), eq(onlineExamQuestions.tenantId, tenantId)))
      .orderBy(asc(onlineExamQuestions.orderIndex));

    const questionIds = questions.map(q => q.id);
    const options = questionIds.length > 0
      ? await db
        .select({
          id: onlineExamQuestionOptions.id,
          questionId: onlineExamQuestionOptions.questionId,
          optionText: onlineExamQuestionOptions.optionText,
        })
        .from(onlineExamQuestionOptions)
        .where(inArray(onlineExamQuestionOptions.questionId, questionIds))
      : [];

    const optionsByQuestion = new Map<string, Array<{ id: string; questionId: string; optionText: string }>>();
    for (const opt of options) {
      const existing = optionsByQuestion.get(opt.questionId) ?? [];
      existing.push(opt);
      optionsByQuestion.set(opt.questionId, existing);
    }

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          durationMinutes: exam.durationMinutes,
          startsAt: exam.startsAt,
          endsAt: exam.endsAt,
        },
        serverNow: nowIso,
        attemptStartedAt: attempt.startedAt,
        deadline: deadline.toISOString(),
        questions: questions.map(q => ({ ...q, options: optionsByQuestion.get(q.id) ?? [] })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
