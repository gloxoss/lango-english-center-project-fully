import type { ExamTermStage } from '@/features/assessment/services/exam-term-workflow';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { examTerms } from '@/features/assessment/models/assessment-schema';
import { loadExamTermFacts } from '@/features/assessment/services/exam-term-facts';
import { OutcomeService } from '@/features/assessment/services/outcome-service';
import {
  checkTransition,
  EXAM_TERM_STAGES,

  nextStage,
  STAGE_LABELS,
} from '@/features/assessment/services/exam-term-workflow';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const stageSchema = z.object({
  stage: z.enum(EXAM_TERM_STAGES),
}).strict();

/**
 * The term's current stage, what it may move to next, and why not if it may not.
 *
 * The blocking reason is returned to the UI deliberately: "5 candidat(s) n'ont
 * pas de place attribuée" is actionable, a greyed-out button is not.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const loaded = await loadExamTermFacts(tenantId, id);
    if (!loaded) {
      throw new ApiError(404, 'NOT_FOUND', 'Contrôle introuvable.');
    }

    const { term, facts } = loaded;
    const next = nextStage(term.status);
    const advance = next === null ? null : checkTransition(term.status, next, facts);

    return NextResponse.json({
      success: true,
      data: {
        stage: term.status,
        stageLabel: STAGE_LABELS[term.status],
        stages: EXAM_TERM_STAGES.map(s => ({ stage: s, label: STAGE_LABELS[s] })),
        facts,
        nextStage: next,
        canAdvance: advance?.allowed ?? false,
        blockedReason: advance && !advance.allowed ? advance.message : null,
        blockedCode: advance && !advance.allowed ? advance.code : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Moves the term one stage. Only a school_admin may: advancing to `active`
 * freezes the timetable for everyone, and closing publishes results.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const body = await parseJson(request, stageSchema);

    const loaded = await loadExamTermFacts(tenantId, id);
    if (!loaded) {
      throw new ApiError(404, 'NOT_FOUND', 'Contrôle introuvable.');
    }

    const { term, facts } = loaded;
    const target = body.stage as ExamTermStage;
    const check = checkTransition(term.status, target, facts);

    if (!check.allowed) {
      throw new ApiError(409, check.code, check.message);
    }

    // Closing a term is what publishes its results; isPublished is not a second
    // decision an admin can forget to make.
    const updated = await db.transaction(async (tx) => {
      const [termUpdate] = await tx
        .update(examTerms)
        .set({ status: target, isPublished: target === 'closed' ? true : term.isPublished })
        .where(and(eq(examTerms.id, id), eq(examTerms.tenantId, tenantId)))
        .returning();

      if (target === 'closed') {
        await OutcomeService.publishOutcomes(context, {
          examTermId: id,
          tx,
          reason: 'Exam term closed',
        });
      }

      return termUpdate;
    });

    recordAudit(context, 'update', 'exam_term_stage', id, { from: term.status, to: target });

    return NextResponse.json({ success: true, data: updated! });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
