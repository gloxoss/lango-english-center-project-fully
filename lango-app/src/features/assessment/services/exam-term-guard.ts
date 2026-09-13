import type { ExamTermAction, ExamTermStage } from './exam-term-workflow';
import { and, eq } from 'drizzle-orm';
import { examTerms } from '@/features/assessment/models/assessment-schema';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  assertCanPerform,

  isExamTermStage,
} from './exam-term-workflow';

/**
 * Loads a term and refuses the request unless its current stage permits
 * `action`. Returns the stage so callers can use it without a second read.
 *
 * Route handlers call this instead of checking status inline so a new operation
 * cannot be added that quietly bypasses the workflow.
 */
export async function requireExamTermStage(
  tenantId: string,
  examTermId: string,
  action: ExamTermAction,
): Promise<ExamTermStage> {
  const [term] = await db
    .select({ id: examTerms.id, status: examTerms.status })
    .from(examTerms)
    .where(and(eq(examTerms.id, examTermId), eq(examTerms.tenantId, tenantId)))
    .limit(1);

  if (!term) {
    throw new ApiError(404, 'NOT_FOUND', 'Contrôle introuvable.');
  }

  if (!isExamTermStage(term.status)) {
    // Rows written before the workflow existed, or by hand. Failing loudly beats
    // guessing which stage an unrecognised value was meant to be.
    throw new ApiError(409, 'INVALID_STAGE', `Étape de contrôle inconnue : « ${term.status} ».`);
  }

  const check = assertCanPerform(term.status, action);
  if (!check.allowed) {
    throw new ApiError(409, check.code, check.message);
  }

  return term.status;
}
