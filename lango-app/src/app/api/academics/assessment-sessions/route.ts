import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { assessmentCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentPlans, assessmentResults, assessments, classes, classSubjects, subjects } from '@/models/Schema';

// ponytail: named "assessment-sessions" (not "assessments", already taken by
// src/app/api/academics/assessments/route.ts which manages assessmentResults
// / grade entry) - this route creates/lists rows in the `assessments` table
// itself, i.e. "define a test/exam instance under a plan".

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const assessmentPlanId = searchParams.get('assessmentPlanId');
    const classSubjectId = searchParams.get('classSubjectId');

    const filters = [eq(assessments.tenantId, tenantId)];
    if (assessmentPlanId) {
      filters.push(eq(assessments.assessmentPlanId, assessmentPlanId));
    }
    if (classSubjectId) {
      filters.push(eq(assessmentPlans.classSubjectId, classSubjectId));
    }

    const rows = await db
      .select({
        id: assessments.id,
        assessmentPlanId: assessments.assessmentPlanId,
        title: assessments.title,
        assessmentDate: assessments.assessmentDate,
        planName: assessmentPlans.name,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(assessments)
      .innerJoin(assessmentPlans, eq(assessments.assessmentPlanId, assessmentPlans.id))
      .innerJoin(classSubjects, eq(assessmentPlans.classSubjectId, classSubjects.id))
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(...filters));

    const gradeCounts = rows.length > 0
      ? await db
          .select({ assessmentId: assessmentResults.assessmentId, gradedCount: count() })
          .from(assessmentResults)
          .where(eq(assessmentResults.tenantId, tenantId))
          .groupBy(assessmentResults.assessmentId)
      : [];
    const gradedById = new Map(gradeCounts.map(g => [g.assessmentId, g.gradedCount]));

    const data = rows.map(r => ({ ...r, gradedCount: gradedById.get(r.id) ?? 0 }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, assessmentCreateSchema);

    const [plan] = await db
      .select({ id: assessmentPlans.id })
      .from(assessmentPlans)
      .where(and(eq(assessmentPlans.id, body.assessmentPlanId), eq(assessmentPlans.tenantId, tenantId)))
      .limit(1);
    if (!plan) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le plan d\'évaluation indiqué n\'existe pas pour cet établissement.');
    }

    const [inserted] = await db
      .insert(assessments)
      .values({ tenantId, assessmentPlanId: body.assessmentPlanId, title: body.title, assessmentDate: body.assessmentDate })
      .returning();

    recordAudit(context, 'create', 'assessment', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Évaluation créée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
