import type { RequestContext } from '@/libs/api/context';
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classes,
  classSections,
  promotionBatches,
  promotionDecisions,
  sections,
  sessionYears,
  studentPlacements,
  user,
} from '@/models/Schema';

export type PromotionDecisionType = 'promote' | 'repeat' | 'graduate' | 'transfer' | 'withdraw' | 'hold';

export type PromotionDecisionInput = {
  studentId: string;
  decision: PromotionDecisionType;
  targetClassSectionId?: string | null;
  averagePercentage?: number | null;
  reason?: string | null;
};

export type ExecutePromotionBatchInput = {
  context: RequestContext;
  sourceClassSectionId: string;
  targetSessionYearId?: string | null;
  idempotencyKey: string;
  decisions: PromotionDecisionInput[];
  effectiveDate?: string;
};

export type ExecutePromotionBatchResult = {
  success: boolean;
  batch: typeof promotionBatches.$inferSelect;
  decisions: (typeof promotionDecisions.$inferSelect)[];
  idempotent?: boolean;
};

export type PromotionCapacityAssignment = {
  classSectionId: string;
  studentCount: number;
};

export type PromotionCapacityBreakdownItem = {
  classSectionId: string;
  className: string;
  sectionName: string;
  maxStudents: number | null;
  currentStudentsCount: number;
  proposedStudentsCount: number;
  projectedOccupancy: number;
  remainingAfter: number | null;
  headroom: number | null;
  isConfigured: boolean;
  isExceeded: boolean;
};

/**
 * Authoritative Canonical Domain Service for SchoolOS Student Promotions & Re-enrollment.
 *
 * Implements:
 * 1. Single-transaction all-or-nothing batch atomicity (0 partial writes on failure)
 * 2. Deterministic pessimistic locking on target class sections (FOR UPDATE)
 * 3. Advisory concurrency locking per student (pg_advisory_xact_lock)
 * 4. Authoritative capacity contract (class_sections.maxStudents + student_placements)
 * 5. Target session verification (must exist, must be subsequent to active session)
 * 6. Historical placement preservation (isCurrent=false, endDate=effectiveDate)
 * 7. Target placement activation (isCurrent=true, startDate=effectiveDate, sessionYearId)
 * 8. User current classSectionId projection synchronization
 * 9. Idempotent re-submission support via idempotencyKey
 * 10. Immutable CNDP Law 09-08 audit log generation
 */
export async function executePromotionBatch(
  input: ExecutePromotionBatchInput,
): Promise<ExecutePromotionBatchResult> {
  const { context, sourceClassSectionId, idempotencyKey, decisions } = input;
  const tenantId = context.tenantId;

  if (!tenantId) {
    throw new ApiError(400, 'MISSING_TENANT', 'Identifiant établissement requis.');
  }

  if (!decisions || decisions.length === 0) {
    throw new ApiError(400, 'EMPTY_BATCH', 'Veuillez sélectionner au moins un élève pour la promotion.');
  }

  // Preflight 1: Prevent duplicate students within the same batch payload
  const studentIdSet = new Set<string>();
  for (const d of decisions) {
    if (studentIdSet.has(d.studentId)) {
      throw new ApiError(422, 'DUPLICATE_STUDENT_IN_BATCH', `L'élève ${d.studentId} apparaît plusieurs fois dans ce lot.`);
    }
    studentIdSet.add(d.studentId);
  }

  // Preflight 2: Pending/hold decisions are not committable
  if (decisions.some(d => d.decision === 'hold')) {
    throw new ApiError(409, 'PENDING_DECISIONS', 'Traitez toutes les décisions en attente avant de confirmer la promotion.');
  }

  // Preflight 3: Idempotency check before acquiring write transactions
  const [alreadyCommitted] = await db
    .select()
    .from(promotionBatches)
    .where(and(eq(promotionBatches.tenantId, tenantId), eq(promotionBatches.idempotencyKey, idempotencyKey)))
    .limit(1);

  if (alreadyCommitted) {
    const existingDecisions = await db
      .select()
      .from(promotionDecisions)
      .where(and(eq(promotionDecisions.tenantId, tenantId), eq(promotionDecisions.batchId, alreadyCommitted.id)));
    return {
      success: true,
      batch: alreadyCommitted,
      decisions: existingDecisions,
      idempotent: true,
    };
  }

  // Preflight 4: Source section verification
  const [sourceSection] = await db
    .select({
      id: classSections.id,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(classSections.id, sourceClassSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);

  if (!sourceSection) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section source n\'existe pas dans cet établissement.');
  }

  // Preflight 5: Active source session year resolution
  const [sourceYear] = await db
    .select({ id: sessionYears.id, startDate: sessionYears.startDate, name: sessionYears.name })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  if (!sourceYear) {
    throw new ApiError(422, 'NO_SOURCE_SESSION', 'Configurez une année scolaire active avant la promotion.');
  }

  // Preflight 6: Target session year resolution & verification
  let targetSessionYearId = input.targetSessionYearId;
  if (!targetSessionYearId) {
    const [nextYear] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(eq(sessionYears.tenantId, tenantId), gt(sessionYears.startDate, sourceYear.startDate)))
      .orderBy(asc(sessionYears.startDate))
      .limit(1);
    targetSessionYearId = nextYear?.id;
  }

  if (!targetSessionYearId) {
    throw new ApiError(422, 'NO_TARGET_SESSION', 'Configurez l’année scolaire suivante avant la promotion.');
  }

  const [targetYear] = await db
    .select({ id: sessionYears.id, startDate: sessionYears.startDate, name: sessionYears.name })
    .from(sessionYears)
    .where(and(eq(sessionYears.id, targetSessionYearId), eq(sessionYears.tenantId, tenantId)))
    .limit(1);

  if (!targetYear || targetYear.startDate <= sourceYear.startDate) {
    throw new ApiError(422, 'INVALID_TARGET_SESSION', 'La session cible doit commencer après l’année scolaire active.');
  }

  // Preflight 7: Student eligibility (must be role=student and currently assigned to source section)
  const eligibleStudents = await db
    .select({
      id: user.id,
      name: user.name,
      classSectionId: user.classSectionId,
    })
    .from(user)
    .where(
      and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, sourceClassSectionId),
      ),
    );

  const eligibleMap = new Map(eligibleStudents.map(s => [s.id, s]));

  for (const decision of decisions) {
    if (!eligibleMap.has(decision.studentId)) {
      throw new ApiError(422, 'INVALID_REFERENCE', `L'élève ${decision.studentId} ne fait pas partie de la section source.`);
    }
  }

  // Preflight 8: Target section validation and incoming count aggregation
  const incomingCountBySection = new Map<string, number>();

  for (const decision of decisions) {
    if (decision.decision === 'promote' || decision.decision === 'repeat') {
      if (!decision.targetClassSectionId) {
        throw new ApiError(422, 'MISSING_TARGET_SECTION', `Une section cible est requise pour l'élève ${decision.studentId}.`);
      }
      const targetSecId = decision.targetClassSectionId;
      incomingCountBySection.set(targetSecId, (incomingCountBySection.get(targetSecId) || 0) + 1);
    }
  }

  const distinctTargetSectionIds = Array.from(incomingCountBySection.keys()).sort();

  // Validate all target sections exist within the caller's tenant
  const targetSectionsData = distinctTargetSectionIds.length > 0
    ? await db
        .select({
          id: classSections.id,
          classId: classSections.classId,
          sectionId: classSections.sectionId,
          maxStudents: classSections.maxStudents,
          className: classes.name,
          sectionName: sections.name,
          branchId: classes.branchId,
        })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(
          and(
            eq(classSections.tenantId, tenantId),
            inArray(classSections.id, distinctTargetSectionIds),
          ),
        )
    : [];

  const targetSectionsMap = new Map(targetSectionsData.map(s => [s.id, s]));

  for (const targetId of distinctTargetSectionIds) {
    if (!targetSectionsMap.has(targetId)) {
      throw new ApiError(422, 'INVALID_TARGET_SECTION', `La section cible ${targetId} est introuvable dans cet établissement.`);
    }
  }

  const effectiveDate = input.effectiveDate || new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // Preflight 6b: Future school-year activation semantics (P0 Lifecycle Invariant)
  // Placement activation cannot occur before the target session start date.
  // A student must not cease belonging to the current active academic year merely because
  // next year's promotion decision was prepared early.
  if (effectiveDate < targetYear.startDate) {
    throw new ApiError(
      422,
      'PREMATURE_ACTIVATION',
      `La promotion vers la session ${targetYear.name} ne peut être activée avant sa date de début (${targetYear.startDate}). L'année scolaire active (${sourceYear.name}) reste en cours.`,
    );
  }

  // ATOMIC DATABASE TRANSACTION (All-or-Nothing Execution)
  return db.transaction(async (tx) => {
    // Lock target class sections deterministically (in sorted ID order)
    for (const targetSecId of distinctTargetSectionIds) {
      await tx.execute(
        sql`SELECT id FROM class_sections WHERE id = ${targetSecId} AND tenant_id = ${tenantId} FOR UPDATE`,
      );
    }

    // Server-side Authoritative Capacity Preflight inside lock
    for (const targetSecId of distinctTargetSectionIds) {
      const sectionInfo = targetSectionsMap.get(targetSecId)!;

      if (sectionInfo.maxStudents == null) {
        throw new ApiError(
          422,
          'CAPACITY_NOT_CONFIGURED',
          `La capacité maximale de cette section (${sectionInfo.className} - ${sectionInfo.sectionName}) n'est pas configurée.`,
        );
      }

      const [enrolledRow] = await tx
        .select({ count: count() })
        .from(studentPlacements)
        .where(
          and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.classSectionId, targetSecId),
            eq(studentPlacements.isCurrent, true),
          ),
        );

      const currentOccupancy = Number(enrolledRow?.count ?? 0);
      const incoming = incomingCountBySection.get(targetSecId) || 0;

      if (currentOccupancy >= sectionInfo.maxStudents) {
        throw new ApiError(
          409,
          'CAPACITY_EXCEEDED',
          `La capacité maximale de cette section (${sectionInfo.maxStudents} élèves) est déjà atteinte.`,
        );
      }

      if (currentOccupancy + incoming > sectionInfo.maxStudents) {
        throw new ApiError(
          409,
          'CAPACITY_EXCEEDED',
          `La capacité de la section (${sectionInfo.className} - ${sectionInfo.sectionName}) serait dépassée : ${currentOccupancy + incoming} élèves prévus pour ${sectionInfo.maxStudents} places.`,
        );
      }
    }

    // Insert batch row
    const [batch] = await tx
      .insert(promotionBatches)
      .values({
        tenantId,
        sourceClassSectionId,
        targetSessionYearId,
        idempotencyKey,
        operatorId: context.userId,
      })
      .returning();

    if (!batch) {
      throw new ApiError(500, 'BATCH_CREATION_FAILED', 'Impossible d’enregistrer le lot de promotion.');
    }

    const decisionRows: (typeof promotionDecisions.$inferInsert)[] = [];

    // Sort decisions by studentId to prevent lock deadlocks
    const sortedDecisions = [...decisions].sort((a, b) => a.studentId.localeCompare(b.studentId));

    for (const decision of sortedDecisions) {
      // Advisory transaction lock per student
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${decision.studentId}`}, 0))`,
      );

      // Inspect active current placement
      const [currentPlacement] = await tx
        .select({
          id: studentPlacements.id,
          startDate: studentPlacements.startDate,
          sessionYearId: studentPlacements.sessionYearId,
          classSectionId: studentPlacements.classSectionId,
        })
        .from(studentPlacements)
        .where(
          and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.studentId, decision.studentId),
            eq(studentPlacements.isCurrent, true),
          ),
        )
        .limit(1);

      let placementId: string | null = null;

      if (decision.decision === 'promote' || decision.decision === 'repeat') {
        const targetSecId = decision.targetClassSectionId!;

        // Close current placement historically
        if (currentPlacement) {
          await tx
            .update(studentPlacements)
            .set({
              isCurrent: false,
              endDate: effectiveDate,
              updatedAt: nowIso,
            })
            .where(
              and(
                eq(studentPlacements.id, currentPlacement.id),
                eq(studentPlacements.tenantId, tenantId),
              ),
            );
        }

        // Insert new placement in target session
        const [newPlacement] = await tx
          .insert(studentPlacements)
          .values({
            tenantId,
            studentId: decision.studentId,
            sessionYearId: targetSessionYearId,
            classSectionId: targetSecId,
            status: 'enrolled',
            startDate: effectiveDate,
            isCurrent: true,
            promotedFromPlacementId: currentPlacement?.id ?? null,
            notes: decision.reason || (decision.decision === 'promote' ? 'Promotion' : 'Redoublement'),
          })
          .returning();

        placementId = newPlacement?.id ?? null;

        // Synchronize user projection
        await tx
          .update(user)
          .set({
            classSectionId: targetSecId,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(user.id, decision.studentId),
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
            ),
          );
      } else if (decision.decision === 'graduate') {
        if (currentPlacement) {
          await tx
            .update(studentPlacements)
            .set({
              isCurrent: false,
              endDate: effectiveDate,
              status: 'graduated',
              notes: decision.reason || 'Fin de scolarité / Diplômé',
              updatedAt: nowIso,
            })
            .where(
              and(
                eq(studentPlacements.id, currentPlacement.id),
                eq(studentPlacements.tenantId, tenantId),
              ),
            );
          placementId = currentPlacement.id;
        }

        await tx
          .update(user)
          .set({
            role: 'alumni',
            userStatus: 'archived',
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(user.id, decision.studentId),
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
            ),
          );
      } else if (decision.decision === 'transfer' || decision.decision === 'withdraw') {
        if (currentPlacement) {
          await tx
            .update(studentPlacements)
            .set({
              isCurrent: false,
              endDate: effectiveDate,
              status: 'dropped',
              notes: decision.reason || (decision.decision === 'transfer' ? 'Transfert sortant' : 'Abandon / Radiation'),
              updatedAt: nowIso,
            })
            .where(
              and(
                eq(studentPlacements.id, currentPlacement.id),
                eq(studentPlacements.tenantId, tenantId),
              ),
            );
          placementId = currentPlacement.id;
        }

        await tx
          .update(user)
          .set({
            userStatus: 'inactive',
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(user.id, decision.studentId),
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
            ),
          );
      }

      decisionRows.push({
        tenantId,
        batchId: batch.id,
        studentId: decision.studentId,
        decision: decision.decision,
        targetClassSectionId: decision.targetClassSectionId || null,
        placementId,
        averagePercentageAtDecision: decision.averagePercentage != null ? String(decision.averagePercentage) : null,
        reason: decision.reason || null,
      });
    }

    const insertedDecisions = decisionRows.length > 0
      ? await tx.insert(promotionDecisions).values(decisionRows).returning()
      : [];

    recordAudit(context, 'create', 'promotion_batch', batch.id, {
      sourceClassSectionId,
      targetSessionYearId,
      decisionCount: decisionRows.length,
      operatorId: context.userId,
      timestamp: nowIso,
    });

    return {
      success: true,
      batch,
      decisions: insertedDecisions,
    };
  });
}

/**
 * Authoritative Canonical Capacity Check Service for Promotions.
 * Replaces academic_class_offerings checks with authoritative class_sections & student_placements.
 */
export async function checkPromotionCapacities(
  tenantId: string,
  assignments: PromotionCapacityAssignment[],
): Promise<{
  hasCapacityExceeded: boolean;
  hasCapacityUnconfigured: boolean;
  breakdown: PromotionCapacityBreakdownItem[];
}> {
  if (!assignments || assignments.length === 0) {
    return {
      hasCapacityExceeded: false,
      hasCapacityUnconfigured: false,
      breakdown: [],
    };
  }

  const sectionIds = Array.from(new Set(assignments.map(a => a.classSectionId))).filter(Boolean);

  const sectionsData = sectionIds.length > 0
    ? await db
        .select({
          id: classSections.id,
          maxStudents: classSections.maxStudents,
          className: classes.name,
          sectionName: sections.name,
        })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(
          and(
            eq(classSections.tenantId, tenantId),
            inArray(classSections.id, sectionIds),
          ),
        )
    : [];

  const sectionMap = new Map(sectionsData.map(s => [s.id, s]));

  const breakdown: PromotionCapacityBreakdownItem[] = await Promise.all(
    assignments.map(async (item) => {
      const sec = sectionMap.get(item.classSectionId);

      const [enrolledRow] = await db
        .select({ count: count() })
        .from(studentPlacements)
        .where(
          and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.classSectionId, item.classSectionId),
            eq(studentPlacements.isCurrent, true),
          ),
        );

      const currentStudentsCount = Number(enrolledRow?.count ?? 0);
      const proposed = item.studentCount ?? 0;
      const maxStudents = sec?.maxStudents ?? null;
      const isConfigured = maxStudents != null;
      const total = currentStudentsCount + proposed;
      const projectedOccupancy = total;
      const remainingAfter = isConfigured ? maxStudents - projectedOccupancy : null;
      const headroom = remainingAfter;
      const isExceeded = isConfigured ? remainingAfter! < 0 : false;

      return {
        classSectionId: item.classSectionId,
        className: sec?.className || 'Classe',
        sectionName: sec?.sectionName || 'Section',
        maxStudents,
        currentStudentsCount,
        proposedStudentsCount: proposed,
        projectedOccupancy,
        remainingAfter,
        headroom,
        isConfigured,
        isExceeded,
      };
    }),
  );

  const hasCapacityExceeded = breakdown.some(b => b.isExceeded);
  const hasCapacityUnconfigured = breakdown.some(b => !b.isConfigured);

  return {
    hasCapacityExceeded,
    hasCapacityUnconfigured,
    breakdown,
  };
}
