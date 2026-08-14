import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { closeStudentPlacement, recordStudentPlacement } from '@/libs/services/student-placement';
import { db } from '@/libs/DB';
import { classSections, promotionBatches, promotionDecisions, sessionYears, user } from '@/models/Schema';

const decisionSchema = z.object({
  studentId: z.string().min(1),
  decision: z.enum(['promote', 'repeat', 'graduate', 'transfer', 'withdraw', 'hold']),
  targetClassSectionId: z.string().uuid().optional(),
  averagePercentage: z.number().min(0).max(100).nullable().optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();

const commitSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetSessionYearId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(100),
  decisions: z.array(decisionSchema).min(1).max(500),
}).strict();

// Bridges the pre-ledger caller shape (bulk move, no per-student decision)
// while other in-flight UI work still targets it - drop once promotions-view.tsx
// is wired to the decisions-based contract above.
const legacyBulkSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetClassSectionId: z.string().uuid(),
  targetSessionYearId: z.string().uuid().optional(),
  studentIds: z.array(z.string().min(1)).optional(),
}).strict();

const requestSchema = z.union([commitSchema, legacyBulkSchema]);

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.placements.manage');

    const batches = await db
      .select({
        id: promotionBatches.id,
        sourceClassSectionId: promotionBatches.sourceClassSectionId,
        targetSessionYearId: promotionBatches.targetSessionYearId,
        targetSessionYearName: sessionYears.name,
        status: promotionBatches.status,
        operatorId: promotionBatches.operatorId,
        createdAt: promotionBatches.createdAt,
      })
      .from(promotionBatches)
      .innerJoin(sessionYears, eq(promotionBatches.targetSessionYearId, sessionYears.id))
      .where(eq(promotionBatches.tenantId, tenantId))
      .orderBy(desc(promotionBatches.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.placements.manage');
    const rawBody = await parseJson(request, requestSchema);

    const [sourceSection] = await db.select({ id: classSections.id }).from(classSections)
      .where(and(eq(classSections.id, rawBody.sourceClassSectionId), eq(classSections.tenantId, tenantId))).limit(1);
    if (!sourceSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section source n\'existe pas.');
    }

    let targetSessionYearId = rawBody.targetSessionYearId;
    if (!targetSessionYearId) {
      const [activeYear] = await db.select({ id: sessionYears.id }).from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true))).limit(1);
      targetSessionYearId = activeYear?.id;
    }
    if (!targetSessionYearId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Aucune année scolaire active trouvée.');
    }

    // Students eligible for this batch (must currently sit in the source section).
    const eligibleIds = new Set((await db.select({ id: user.id }).from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, rawBody.sourceClassSectionId))))
      .map(s => s.id));

    const body = 'decisions' in rawBody
      ? rawBody
      : {
          sourceClassSectionId: rawBody.sourceClassSectionId,
          targetSessionYearId,
          idempotencyKey: crypto.randomUUID(),
          decisions: (rawBody.studentIds && rawBody.studentIds.length > 0 ? rawBody.studentIds : Array.from(eligibleIds))
            .map(studentId => ({
              studentId,
              decision: 'promote' as const,
              targetClassSectionId: rawBody.targetClassSectionId,
              averagePercentage: undefined,
              reason: undefined,
            })),
        };

    // Idempotent retry: an already-committed batch for this key is returned as-is,
    // not reprocessed - recordStudentPlacement/closeStudentPlacement calls that
    // already landed must never be repeated once the batch row exists. Legacy
    // callers get a fresh key every call (no retry protection, same as before).
    const [existingBatch] = await db.select().from(promotionBatches)
      .where(and(eq(promotionBatches.tenantId, tenantId), eq(promotionBatches.idempotencyKey, body.idempotencyKey)))
      .limit(1);
    if (existingBatch) {
      const decisions = await db.select().from(promotionDecisions).where(eq(promotionDecisions.batchId, existingBatch.id));
      return NextResponse.json({ success: true, data: { batch: existingBatch, decisions } });
    }

    const decisionRows: (typeof promotionDecisions.$inferInsert)[] = [];

    for (const decision of body.decisions) {
      if (!eligibleIds.has(decision.studentId)) {
        throw new ApiError(422, 'INVALID_REFERENCE', `L'élève ${decision.studentId} ne fait pas partie de la section source.`);
      }

      let placementId: string | null = null;

      if (decision.decision === 'promote' || decision.decision === 'repeat') {
        if (!decision.targetClassSectionId) {
          throw new ApiError(422, 'MISSING_TARGET_SECTION', `Une section cible est requise pour l'élève ${decision.studentId}.`);
        }
        const placement = await recordStudentPlacement({
          tenantId,
          studentId: decision.studentId,
          sessionYearId: targetSessionYearId,
          classSectionId: decision.targetClassSectionId,
          promotedFromPlacementId: undefined,
          notes: decision.reason ?? (decision.decision === 'promote' ? 'Promotion' : 'Redoublement'),
        });
        placementId = placement.id;
      } else if (decision.decision === 'graduate') {
        const closed = await closeStudentPlacement({ tenantId, studentId: decision.studentId, status: 'graduated', notes: decision.reason });
        placementId = closed?.id ?? null;
      } else if (decision.decision === 'transfer' || decision.decision === 'withdraw') {
        const closed = await closeStudentPlacement({ tenantId, studentId: decision.studentId, status: 'dropped', notes: decision.reason });
        placementId = closed?.id ?? null;
      }
      // 'hold': no placement change, decision recorded only for follow-up.

      decisionRows.push({
        tenantId,
        batchId: '', // filled in after the batch row is inserted below
        studentId: decision.studentId,
        decision: decision.decision,
        targetClassSectionId: decision.targetClassSectionId ?? null,
        placementId,
        averagePercentageAtDecision: decision.averagePercentage != null ? String(decision.averagePercentage) : null,
        reason: decision.reason ?? null,
      });
    }

    // Batch + decision rows are written last, atomically, only once every
    // per-student operation above succeeded - see student-placement.ts's
    // per-student idempotent design: a failure mid-loop leaves no batch row,
    // so retrying the same idempotencyKey safely resumes (already-applied
    // placements no-op, the rest proceed) rather than double-applying.
    const [batch] = await db.insert(promotionBatches).values({
      tenantId,
      sourceClassSectionId: body.sourceClassSectionId,
      targetSessionYearId,
      idempotencyKey: body.idempotencyKey,
      operatorId: context.userId,
    }).returning();

    const insertedDecisions = decisionRows.length > 0
      ? await db.insert(promotionDecisions).values(decisionRows.map(row => ({ ...row, batchId: batch!.id }))).returning()
      : [];

    recordAudit(context, 'create', 'promotion_batch', batch!.id, {
      sourceClassSectionId: body.sourceClassSectionId,
      targetSessionYearId,
      decisionCount: decisionRows.length,
    });

    return NextResponse.json({
      success: true,
      data: { batch, decisions: insertedDecisions },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
