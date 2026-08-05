import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, payments, promotionBatches, promotionDecisions, studentPlacements, user } from '@/models/Schema';

export const revertPromotionSchema = z.object({
  batchId: z.string().uuid({ message: 'L\'identifiant du lot de promotion est requis.' }),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, revertPromotionSchema);

    // Fetch target batch
    const [batch] = await db
      .select()
      .from(promotionBatches)
      .where(and(eq(promotionBatches.id, body.batchId), eq(promotionBatches.tenantId, tenantId)))
      .limit(1);

    if (!batch) {
      throw new ApiError(404, 'NOT_FOUND', 'Le lot de promotion demandé est introuvable.');
    }

    if (batch.status === 'reverted') {
      throw new ApiError(409, 'ALREADY_REVERTED', 'Ce lot de promotion a déjà été annulé.');
    }

    // Fetch decisions
    const decisions = await db
      .select()
      .from(promotionDecisions)
      .where(and(eq(promotionDecisions.batchId, batch.id), eq(promotionDecisions.tenantId, tenantId)));

    const studentIds = decisions.map((d) => d.studentId);
    const batchCreatedAt = batch.createdAt;

    if (studentIds.length > 0) {
      // 1. Dependency check: Attendance records created AFTER promotion batch date
      const [attendanceCount] = await db
        .select({ count: count() })
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          inArray(attendance.studentId, studentIds),
          gte(attendance.createdAt, batchCreatedAt),
        ));

      // 2. Dependency check: Payments recorded AFTER promotion batch date
      const [paymentsCount] = await db
        .select({ count: count() })
        .from(payments)
        .where(and(
          eq(payments.tenantId, tenantId),
          inArray(payments.studentId, studentIds),
          gte(payments.createdAt, batchCreatedAt),
        ));

      const totalDependencies = (attendanceCount?.count ?? 0) + (paymentsCount?.count ?? 0);

      if (totalDependencies > 0) {
        throw new ApiError(
          409,
          'CANNOT_REVERT_HAS_DEPENDENCIES',
          `Annulation impossible : ${totalDependencies} activité(s) (présences, paiements) ont été enregistrées pour les élèves de ce lot après la promotion.`,
        );
      }
    }

    // Execute atomic rollback and restore predecessor placements
    await db.transaction(async (tx) => {
      for (const d of decisions) {
        let restoredSectionId = batch.sourceClassSectionId;

        if (d.placementId) {
          const [currentPlacement] = await tx
            .select()
            .from(studentPlacements)
            .where(and(eq(studentPlacements.id, d.placementId), eq(studentPlacements.tenantId, tenantId)))
            .limit(1);

          if (currentPlacement) {
            // Deactivate new placement created by promotion
            await tx
              .update(studentPlacements)
              .set({ isCurrent: false, status: 'dropped', updatedAt: new Date().toISOString() })
              .where(and(eq(studentPlacements.id, d.placementId), eq(studentPlacements.tenantId, tenantId)));

            // Restore predecessor placement if present
            if (currentPlacement.promotedFromPlacementId) {
              const [predecessor] = await tx
                .select()
                .from(studentPlacements)
                .where(and(eq(studentPlacements.id, currentPlacement.promotedFromPlacementId), eq(studentPlacements.tenantId, tenantId)))
                .limit(1);

              if (predecessor) {
                restoredSectionId = predecessor.classSectionId;
                await tx
                  .update(studentPlacements)
                  .set({ isCurrent: true, endDate: null, status: 'enrolled', updatedAt: new Date().toISOString() })
                  .where(and(eq(studentPlacements.id, predecessor.id), eq(studentPlacements.tenantId, tenantId)));
              }
            }
          }
        }

        // Restore student user record classSectionId
        await tx
          .update(user)
          .set({ classSectionId: restoredSectionId, updatedAt: new Date().toISOString() })
          .where(and(eq(user.id, d.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')));
      }

      // Mark batch as reverted
      await tx
        .update(promotionBatches)
        .set({ status: 'reverted', revertedAt: new Date().toISOString() })
        .where(and(eq(promotionBatches.id, batch.id), eq(promotionBatches.tenantId, tenantId)));

      recordAudit(context, 'update', 'promotion_batch_reverted', batch.id);
    });

    return NextResponse.json({
      success: true,
      message: 'Lot de promotion annulé avec succès.',
      batchId: batch.id,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
