import { db } from '@/libs/DB';
import { assessmentOutcomes, assessmentOutcomeRevisions, assessmentDefinitions } from '../models/assessment-schema';
import { eq, and } from 'drizzle-orm';
import type { OutcomeStatus, ModerationState } from '../types/assessment-types';

export class OutcomeService {
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
          eq(assessmentDefinitions.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!def) {
      throw new Error(`Assessment definition ${assessmentDefinitionId} not found`);
    }

    const maxScore = Number(def.maximumScore) || 20;
    const normalizedScore =
      rawScore !== undefined && rawScore !== null
        ? Number(((rawScore / maxScore) * 20).toFixed(2))
        : undefined;

    let grade: string | undefined = undefined;
    if (normalizedScore !== undefined) {
      if (normalizedScore >= 16) grade = 'Très Bien';
      else if (normalizedScore >= 14) grade = 'Bien';
      else if (normalizedScore >= 12) grade = 'Assez Bien';
      else if (normalizedScore >= 10) grade = 'Passable';
      else grade = 'Insuffisant';
    }

    // Check existing outcome
    const [existing] = await db
      .select()
      .from(assessmentOutcomes)
      .where(
        and(
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId),
          eq(assessmentOutcomes.studentId, studentId)
        )
      )
      .limit(1);

    if (existing) {
      // Check moderation lock
      if (existing.moderationState === 'locked' || existing.moderationState === 'published') {
        throw new Error('Assessment outcome is locked/published and cannot be overwritten without unlock approval.');
      }

      // Record revision audit log if score or status changed
      if (
        Number(existing.rawScore) !== rawScore ||
        existing.status !== status
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
  static async lockOutcomes(tenantId: string, assessmentDefinitionId: string, markerId: string) {
    return db
      .update(assessmentOutcomes)
      .set({
        moderationState: 'locked',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(assessmentOutcomes.tenantId, tenantId),
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId)
        )
      )
      .returning();
  }
}
