import type { OutcomeStatus } from '../types/assessment-types';
import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { assessmentDefinitions, assessmentOutcomeRevisions, assessmentOutcomes } from '../models/assessment-schema';

/**
 * The "no mark above the maximum" rule used to live only in the marksheet UI
 * (marksheet-grid.ts), so any other caller could store 155/20 or -3 and skew
 * averages, rankings and report cards. Every write path checks it here.
 */
export function assertScoreInRange(rawScore: number | null | undefined, maxScore: number): void {
  if (rawScore === undefined || rawScore === null) {
    return;
  }
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxScore) {
    throw new ApiError(422, 'SCORE_OUT_OF_RANGE', `La note doit être comprise entre 0 et ${maxScore}.`);
  }
}

export class OutcomeService {
  /**
   * Checks a whole batch before anything is written, so one bad mark cannot
   * leave the rows before it saved and the rest not.
   */
  static async assertScoresInRange(tenantId: string, assessmentDefinitionId: string, scores: Array<number | null | undefined>) {
    const [def] = await db
      .select({ maximumScore: assessmentDefinitions.maximumScore })
      .from(assessmentDefinitions)
      .where(and(eq(assessmentDefinitions.id, assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId)))
      .limit(1);
    if (!def) {
      throw new ApiError(404, 'ASSESSMENT_NOT_FOUND', 'Évaluation introuvable.');
    }
    const maxScore = Number(def.maximumScore) || 20;
    for (const score of scores) {
      assertScoreInRange(score, maxScore);
    }
  }

  /**
   * Post or update a student's assessment outcome in the shared core ledger.
   */
  static async recordOutcome(params: {
    tenantId: string;
    assessmentDefinitionId: string;
    studentId: string;
    rawScore?: number;
    status?: OutcomeStatus;
    sourceType: 'homework_submission' | 'paper_exam' | 'online_attempt';
    sourceReferenceId?: string;
    markerId: string;
    reason?: string;
  }) {
    const {
      tenantId,
      assessmentDefinitionId,
      studentId,
      rawScore,
      status = 'graded',
      sourceType,
      sourceReferenceId,
      markerId,
      reason = 'Initial mark entry',
    } = params;

    // Fetch definition to get maximum score and pass mark
    const [def] = await db
      .select()
      .from(assessmentDefinitions)
      .where(
        and(
          eq(assessmentDefinitions.id, assessmentDefinitionId),
          eq(assessmentDefinitions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!def) {
      throw new Error(`Assessment definition ${assessmentDefinitionId} not found`);
    }

    const maxScore = Number(def.maximumScore) || 20;
    assertScoreInRange(rawScore, maxScore);
    const normalizedScore
      = rawScore !== undefined && rawScore !== null
        ? Number(((rawScore / maxScore) * 20).toFixed(2))
        : undefined;

    let grade: string | undefined;
    if (normalizedScore !== undefined) {
      if (normalizedScore >= 16) {
        grade = 'Très Bien';
      } else if (normalizedScore >= 14) {
        grade = 'Bien';
      } else if (normalizedScore >= 12) {
        grade = 'Assez Bien';
      } else if (normalizedScore >= 10) {
        grade = 'Passable';
      } else {
        grade = 'Insuffisant';
      }
    }

    // Check existing outcome
    const [existing] = await db
      .select()
      .from(assessmentOutcomes)
      .where(
        and(
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId),
          eq(assessmentOutcomes.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      // Check moderation lock
      if (existing.moderationState === 'locked' || existing.moderationState === 'published') {
        // An ApiError, not a bare Error: a locked mark is an expected business
        // condition, and as a plain Error it reached the client as an opaque 500
        // with no hint that the mark needs unlock approval.
        throw new ApiError(
          409,
          'OUTCOME_LOCKED',
          'Cette note est verrouillée ou déjà publiée. Demandez un déverrouillage avant de la modifier.',
        );
      }

      // Record revision audit log if score or status changed
      if (
        Number(existing.rawScore) !== rawScore
        || existing.status !== status
      ) {
        await db.insert(assessmentOutcomeRevisions).values({
          assessmentOutcomeId: existing.id,
          previousScore: existing.rawScore ? String(existing.rawScore) : null,
          newScore: rawScore !== undefined ? String(rawScore) : null,
          previousStatus: existing.status,
          newStatus: status,
          reason,
          changedBy: markerId,
        });
      }

      // Update outcome
      const [updated] = await db
        .update(assessmentOutcomes)
        .set({
          rawScore: rawScore !== undefined ? String(rawScore) : null,
          maximumScoreSnapshot: String(maxScore),
          normalizedScore: normalizedScore !== undefined ? String(normalizedScore) : null,
          grade,
          status,
          markerId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(assessmentOutcomes.id, existing.id))
        .returning();

      return updated;
    }

    // Insert new outcome
    const [created] = await db
      .insert(assessmentOutcomes)
      .values({
        tenantId,
        assessmentDefinitionId,
        studentId,
        rawScore: rawScore !== undefined ? String(rawScore) : null,
        maximumScoreSnapshot: String(maxScore),
        normalizedScore: normalizedScore !== undefined ? String(normalizedScore) : null,
        grade,
        status,
        sourceType,
        sourceReferenceId,
        markerId,
        moderationState: 'draft',
      })
      .returning();

    return created;
  }

  /**
   * Bulk lock outcomes for a given assessment definition upon moderation completion.
   */
  static async lockOutcomes(tenantId: string, assessmentDefinitionId: string, _markerId: string) {
    return db
      .update(assessmentOutcomes)
      .set({
        moderationState: 'locked',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(assessmentOutcomes.tenantId, tenantId),
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId),
        ),
      )
      .returning();
  }
}
