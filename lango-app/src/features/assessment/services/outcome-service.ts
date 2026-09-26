import type { OutcomeStatus } from '../types/assessment-types';
import type { RequestContext } from '@/libs/api/context';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import {
  assessmentDefinitions,
  assessmentOutcomeRevisions,
  assessmentOutcomes,
  examSchedules,
} from '../models/assessment-schema';

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OutcomePublishParams = {
  assessmentDefinitionId?: string;
  examTermId?: string;
  reason?: string;
  tx?: DbExecutor;
};

export type OutcomeUnpublishParams = {
  assessmentDefinitionId: string;
  reason: string;
  tx?: DbExecutor;
};

export type ContextLike =
  | RequestContext
  | {
      tenantId: string;
      userId?: string;
      role?: string;
      impersonated?: boolean;
    };

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

  /**
   * Publishes assessment outcomes by setting moderation_state to 'published'.
   * Targets outcomes with status in ['graded', 'exempted', 'absent'] that are not already published.
   */
  static async publishOutcomes(
    ctx: ContextLike,
    params: OutcomePublishParams,
  ): Promise<{ count: number }> {
    const tenantId = 'tenantId' in ctx && ctx.tenantId ? ctx.tenantId : null;
    if (!tenantId) {
      throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant ID is required.');
    }

    if (!params.assessmentDefinitionId && !params.examTermId) {
      throw new ApiError(400, 'BAD_REQUEST', 'assessmentDefinitionId or examTermId is required.');
    }

    const client = params.tx ?? db;
    const defIdSet = new Set<string>();

    if (params.assessmentDefinitionId) {
      defIdSet.add(params.assessmentDefinitionId);
    }

    if (params.examTermId) {
      const defsFromTerm = await client
        .select({ id: assessmentDefinitions.id })
        .from(assessmentDefinitions)
        .where(and(
          eq(assessmentDefinitions.tenantId, tenantId),
          eq(assessmentDefinitions.termId, params.examTermId),
        ));

      const defsFromSchedules = await client
        .select({ id: examSchedules.assessmentDefinitionId })
        .from(examSchedules)
        .where(and(
          eq(examSchedules.tenantId, tenantId),
          eq(examSchedules.examTermId, params.examTermId),
        ));

      for (const d of defsFromTerm) defIdSet.add(d.id);
      for (const s of defsFromSchedules) defIdSet.add(s.id);
    }

    const definitionIds = Array.from(defIdSet);
    if (definitionIds.length === 0) {
      return { count: 0 };
    }

    const updated = await client
      .update(assessmentOutcomes)
      .set({
        moderationState: 'published',
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        inArray(assessmentOutcomes.assessmentDefinitionId, definitionIds),
        inArray(assessmentOutcomes.status, ['graded', 'exempted', 'absent']),
        ne(assessmentOutcomes.moderationState, 'published'),
      ))
      .returning({ id: assessmentOutcomes.id });

    const auditContext: RequestContext = ('role' in ctx && ctx.role)
      ? (ctx as RequestContext)
      : {
          userId: ctx.userId || 'system',
          tenantId,
          branchId: null,
          role: 'school_admin' as const,
          baseRole: 'school_admin' as const,
          name: 'System',
          email: '',
          impersonated: ctx.impersonated ?? false,
        };

    recordAudit(
      auditContext,
      'update',
      'assessment_outcomes',
      params.assessmentDefinitionId ?? params.examTermId ?? 'batch',
      {
        action: 'publish',
        count: updated.length,
        assessmentDefinitionId: params.assessmentDefinitionId,
        examTermId: params.examTermId,
        reason: params.reason || (params.examTermId ? 'Exam term closed' : 'Outcomes published'),
      },
    );

    return { count: updated.length };
  }

  /**
   * Reverts published assessment outcomes back to 'locked' moderation state.
   * Requires a non-empty reason string.
   */
  static async unpublishOutcomes(
    ctx: ContextLike,
    params: OutcomeUnpublishParams,
  ): Promise<{ count: number }> {
    const tenantId = 'tenantId' in ctx && ctx.tenantId ? ctx.tenantId : null;
    if (!tenantId) {
      throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant ID is required.');
    }

    if (!params.assessmentDefinitionId) {
      throw new ApiError(400, 'BAD_REQUEST', 'assessmentDefinitionId is required.');
    }

    const trimmedReason = params.reason ? params.reason.trim() : '';
    if (!trimmedReason) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Un motif est requis pour retirer la publication des notes.');
    }

    const client = params.tx ?? db;

    const updated = await client
      .update(assessmentOutcomes)
      .set({
        moderationState: 'locked',
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentOutcomes.assessmentDefinitionId, params.assessmentDefinitionId),
        eq(assessmentOutcomes.moderationState, 'published'),
      ))
      .returning({ id: assessmentOutcomes.id });

    const auditContext: RequestContext = ('role' in ctx && ctx.role)
      ? (ctx as RequestContext)
      : {
          userId: ctx.userId || 'system',
          tenantId,
          branchId: null,
          role: 'school_admin' as const,
          baseRole: 'school_admin' as const,
          name: 'System',
          email: '',
          impersonated: ctx.impersonated ?? false,
        };

    recordAudit(
      auditContext,
      'update',
      'assessment_outcomes',
      params.assessmentDefinitionId,
      {
        action: 'unpublish',
        count: updated.length,
        assessmentDefinitionId: params.assessmentDefinitionId,
        reason: trimmedReason,
      },
    );

    return { count: updated.length };
  }
}

export const publishOutcomes = OutcomeService.publishOutcomes;
export const unpublishOutcomes = OutcomeService.unpublishOutcomes;

