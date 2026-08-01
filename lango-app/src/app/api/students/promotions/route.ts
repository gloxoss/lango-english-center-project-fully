import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, user } from '@/models/Schema';

const batchPromotionSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetClassSectionId: z.string().uuid(),
  studentIds: z.array(z.string().min(1)).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, batchPromotionSchema);

    if (body.sourceClassSectionId === body.targetClassSectionId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section cible doit être différente de la section source.');
    }

    // Verify source & target class sections belong to tenant
    const [sourceSection] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, body.sourceClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!sourceSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section source n\'existe pas.');
    }

    const [targetSection] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, body.targetClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!targetSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section cible n\'existe pas.');
    }

    // Execute atomic promotion transaction
    const { promotedCount } = await db.transaction(async (tx) => {
      let whereClause = and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, body.sourceClassSectionId),
      );

      if (body.studentIds && body.studentIds.length > 0) {
        whereClause = and(whereClause, inArray(user.id, body.studentIds));
      }

      const updatedRows = await tx
        .update(user)
        .set({
          classSectionId: body.targetClassSectionId,
          updatedAt: new Date().toISOString(),
        })
        .where(whereClause!)
        .returning({ id: user.id });

      return { promotedCount: updatedRows.length };
    });

    recordAudit(context, 'update', 'class_section', body.sourceClassSectionId, {
      sourceClassSectionId: body.sourceClassSectionId,
      targetClassSectionId: body.targetClassSectionId,
      promotedCount,
    });

    return NextResponse.json({
      success: true,
      promotedCount,
      message: `${promotedCount} élève(s) promus avec succès vers la nouvelle section.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
