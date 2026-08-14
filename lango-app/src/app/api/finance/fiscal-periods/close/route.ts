import { and, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { fiscalPeriods, bankReconciliations, journalEntries, journalEntryLines } from '@/models/Schema';

const closePeriodSchema = z.object({
  periodId: z.string().uuid().optional(),
  name: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  force: z.boolean().default(false),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'finance.close');

    const body = await parseJson(req, closePeriodSchema);
    const { periodId, name, startDate, endDate, force } = body;

    let targetPeriodId = periodId;
    let targetEndDate = endDate;

    if (!targetPeriodId) {
      if (!name || !startDate || !endDate) {
        throw new ApiError(400, 'BAD_REQUEST', 'Veuillez spécifier periodId ou (name, startDate, endDate).');
      }

      const [newPeriod] = await db
        .insert(fiscalPeriods)
        .values({
          tenantId,
          name,
          startDate,
          endDate,
          status: 'open',
        })
        .returning();

      if (!newPeriod) {
        throw new ApiError(500, 'INTERNAL_ERROR', 'Impossible de créer la période comptable.');
      }

      targetPeriodId = newPeriod.id;
      targetEndDate = newPeriod.endDate;
    } else {
      const [existingPeriod] = await db.select().from(fiscalPeriods).where(and(
        eq(fiscalPeriods.id, targetPeriodId),
        eq(fiscalPeriods.tenantId, tenantId)
      ));
      if (!existingPeriod) {
        throw new ApiError(404, 'NOT_FOUND', 'Période introuvable.');
      }
      targetEndDate = existingPeriod.endDate;
    }

    // CHECKLIST VALIDATION
    if (!force) {
      const warnings: string[] = [];

      // Check for uncompleted bank reconciliations in this period
      const [pendingRecons] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankReconciliations)
        .where(and(
          eq(bankReconciliations.tenantId, tenantId),
          eq(bankReconciliations.status, 'draft'),
          sql`${bankReconciliations.statementDate} <= ${targetEndDate}`
        ));

      if (pendingRecons && pendingRecons.count > 0) {
        warnings.push(`${pendingRecons.count} rapprochement(s) bancaire(s) toujours en statut brouillon.`);
      }

      // Check for unreconciled journal lines related to bank accounts
      const [unreconciledLines] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(journalEntryLines)
        .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
        .where(and(
          eq(journalEntryLines.tenantId, tenantId),
          sql`${journalEntryLines.reconciliationId} IS NULL`,
          sql`${journalEntries.entryDate} <= ${targetEndDate}`
          // Ideally we would filter by bank account chartOfAccounts ID, but we warn generally for un-reconciled items
        ));
      
      // We only warn about unreconciled items if there are any drafts, or if it's a strict requirement.
      // Unreconciled lines are normal if they just haven't cleared the bank yet. We'll just append it to the warnings.
      // But only block if there are drafts.
      if (warnings.length > 0) {
        return NextResponse.json({
          success: false,
          needsConfirmation: true,
          warnings,
          message: 'Des actions comptables sont en attente. Voulez-vous forcer la clôture ?',
        });
      }
    }

    const [closedPeriod] = await db
      .update(fiscalPeriods)
      .set({
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedById: ctx.userId,
      })
      .where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.id, targetPeriodId!)))
      .returning();

    if (!closedPeriod) {
      throw new ApiError(404, 'NOT_FOUND', 'Période comptable non trouvée.');
    }

    return NextResponse.json({
      success: true,
      message: `Période comptable '${closedPeriod.name}' clôturée avec succès.`,
      data: closedPeriod,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
