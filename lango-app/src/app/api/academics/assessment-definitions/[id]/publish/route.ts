import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assessmentAudiences,
  assessmentDefinitions,
} from '@/features/assessment/models/assessment-schema';
import { loadScopedMarksheet } from '@/features/assessment/services/marksheet-access';
import { OutcomeService } from '@/features/assessment/services/outcome-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds, getTeacherClassSubjectPairs } from '@/libs/api/teacher-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const unpublishSchema = z.object({
  reason: z.string().trim().min(1, 'Un motif est requis pour retirer la publication des notes.'),
}).strict();

async function assertTeacherAssignedToDefinition(
  context: { role: string; userId: string },
  tenantId: string,
  definition: { id: string; classSubjectId: string | null },
): Promise<void> {
  if (context.role !== 'teacher') {
    return;
  }

  const teacherSections = new Set(await getTeacherClassSectionIds(tenantId, context.userId));

  // 1. Direct audience match
  const audiences = await db
    .select({ sectionId: assessmentAudiences.sectionId })
    .from(assessmentAudiences)
    .where(eq(assessmentAudiences.assessmentDefinitionId, definition.id));

  let isAssigned = audiences.some(a => a.sectionId && teacherSections.has(a.sectionId));

  // 2. Class-subject pair match
  if (!isAssigned && definition.classSubjectId) {
    const pairs = await getTeacherClassSubjectPairs(tenantId, context.userId);
    for (const p of pairs) {
      const [secId, subId] = p.split('|');
      if (subId === definition.classSubjectId && secId && teacherSections.has(secId)) {
        isAssigned = true;
        break;
      }
    }
  }

  // 3. Marksheet student scope fallback
  if (!isAssigned) {
    const requestCtx = {
      userId: context.userId,
      tenantId,
      branchId: null,
      role: 'teacher' as const,
      baseRole: 'teacher' as const,
      name: '',
      email: '',
    };
    const scoped = await loadScopedMarksheet(requestCtx, tenantId, definition.id);
    if (scoped && scoped.students.length > 0) {
      isAssigned = true;
    }
  }

  if (!isAssigned) {
    throw new ApiError(403, 'FORBIDDEN', 'Vous n\'enseignez aucune classe associée à cette évaluation.');
  }
}

/**
 * POST /api/academics/assessment-definitions/[id]/publish
 * Publishes outcomes for this assessment definition.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const [definition] = await db
      .select({ id: assessmentDefinitions.id, classSubjectId: assessmentDefinitions.classSubjectId })
      .from(assessmentDefinitions)
      .where(and(
        eq(assessmentDefinitions.id, id),
        eq(assessmentDefinitions.tenantId, tenantId),
      ))
      .limit(1);

    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Évaluation introuvable.');
    }

    await assertTeacherAssignedToDefinition(context, tenantId, definition);

    const result = await OutcomeService.publishOutcomes(context, {
      assessmentDefinitionId: id,
      reason: 'Published via assessment publish action',
    });

    await db
      .update(assessmentDefinitions)
      .set({ status: 'published', updatedAt: new Date().toISOString() })
      .where(and(eq(assessmentDefinitions.id, id), eq(assessmentDefinitions.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * DELETE /api/academics/assessment-definitions/[id]/publish
 * Unpublishes outcomes (reverts to locked) for this assessment definition. Reason required.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const body = await parseJson(request, unpublishSchema);

    const [definition] = await db
      .select({ id: assessmentDefinitions.id, classSubjectId: assessmentDefinitions.classSubjectId })
      .from(assessmentDefinitions)
      .where(and(
        eq(assessmentDefinitions.id, id),
        eq(assessmentDefinitions.tenantId, tenantId),
      ))
      .limit(1);

    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Évaluation introuvable.');
    }

    await assertTeacherAssignedToDefinition(context, tenantId, definition);

    const result = await OutcomeService.unpublishOutcomes(context, {
      assessmentDefinitionId: id,
      reason: body.reason,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
