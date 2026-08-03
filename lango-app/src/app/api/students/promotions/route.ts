import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import { db } from '@/libs/DB';
import { classSections, sessionYears, user } from '@/models/Schema';

const batchPromotionSchema = z.object({
  sourceClassSectionId: z.string().uuid(),
  targetClassSectionId: z.string().uuid(),
  targetSessionYearId: z.string().uuid().optional(),
  studentIds: z.array(z.string().min(1)).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.placements.manage');
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

    // Get target or default session year
    let targetSessionYearId = body.targetSessionYearId;
    if (!targetSessionYearId) {
      const [activeYear] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionYearId = activeYear?.id;
    }

    if (!targetSessionYearId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Aucune année scolaire active trouvée.');
    }

    // Find candidate students
    let whereClause = and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      eq(user.classSectionId, body.sourceClassSectionId),
    );

    if (body.studentIds && body.studentIds.length > 0) {
      whereClause = and(whereClause, inArray(user.id, body.studentIds));
    }

    const eligibleStudents = await db
      .select({ id: user.id })
      .from(user)
      .where(whereClause!);

    // Record placements atomically for each student
    for (const student of eligibleStudents) {
      await recordStudentPlacement({
        tenantId,
        studentId: student.id,
        sessionYearId: targetSessionYearId,
        classSectionId: body.targetClassSectionId,
        notes: `Promotion de la section ${body.sourceClassSectionId} vers ${body.targetClassSectionId}`,
      });
    }

    recordAudit(context, 'update', 'class_section', body.targetClassSectionId, {
      sourceClassSectionId: body.sourceClassSectionId,
      targetClassSectionId: body.targetClassSectionId,
      promotedCount: eligibleStudents.length,
    });

    return NextResponse.json({
      success: true,
      data: { promotedCount: eligibleStudents.length },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
