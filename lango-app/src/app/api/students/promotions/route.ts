import type { PromotionDecisionInput } from '@/features/students/services/promotion-service';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executePromotionBatch } from '@/features/students/services/promotion-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { promotionBatches, sessionYears } from '@/models/Schema';

const decisionSchema = z.object({
  studentId: z.string().min(1),
  decision: z.enum(['promote', 'repeat', 'graduate', 'transfer', 'withdraw', 'hold']),
  targetClassSectionId: z.string().uuid().optional().nullable(),
  averagePercentage: z.number().min(0).max(100).nullable().optional(),
  reason: z.string().trim().max(500).optional().nullable(),
}).strict();

const commitSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetSessionYearId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(100),
  decisions: z.array(decisionSchema).min(1).max(500),
}).strict();

// Bridges the legacy caller shape (bulk move all to single target section)
const legacyBulkSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetClassSectionId: z.string().uuid(),
  targetSessionYearId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
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
    requireTenant(context);
    await requireCapability(context, 'students.placements.manage');
    const rawBody = await parseJson(request, requestSchema);

    let idempotencyKey: string;
    let decisions: PromotionDecisionInput[];
    let sourceClassSectionId: string;
    let targetSessionYearId: string | null | undefined;

    if ('decisions' in rawBody) {
      idempotencyKey = rawBody.idempotencyKey;
      decisions = rawBody.decisions as PromotionDecisionInput[];
      sourceClassSectionId = rawBody.sourceClassSectionId;
      targetSessionYearId = rawBody.targetSessionYearId;
    } else {
      sourceClassSectionId = rawBody.sourceClassSectionId;
      targetSessionYearId = rawBody.targetSessionYearId;
      idempotencyKey = rawBody.idempotencyKey || crypto.randomUUID();
      const studentIds = rawBody.studentIds || [];
      decisions = studentIds.map(studentId => ({
        studentId,
        decision: 'promote' as const,
        targetClassSectionId: rawBody.targetClassSectionId,
      }));
    }

    const result = await executePromotionBatch({
      context,
      sourceClassSectionId,
      targetSessionYearId,
      idempotencyKey,
      decisions,
    });

    return NextResponse.json({
      success: true,
      data: {
        batch: result.batch,
        decisions: result.decisions,
      },
      batch: result.batch,
      decisions: result.decisions,
      idempotent: result.idempotent,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
