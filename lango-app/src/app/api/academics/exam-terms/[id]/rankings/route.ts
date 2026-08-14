import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const { searchParams } = new URL(request.url);
    const assessmentDefinitionId = searchParams.get('assessmentDefinitionId');
    if (!assessmentDefinitionId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Le paramètre assessmentDefinitionId est requis.');
    }

    const [definition] = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.id, assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId))).limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    const rankings = await ExamMasterService.generateTermRankings(tenantId, assessmentDefinitionId);
    return NextResponse.json({ success: true, data: rankings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
