import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { assessmentCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { assessmentPlans, assessments, classes, classSubjects, subjects } from '@/models/Schema';

// GET lists the canonical assessments (assessment_definitions, GRADES-CANONICAL-01
// GD1) with real counts from assessment_outcomes. It used to list the legacy
// `assessments` table, which nothing writes any more, with gradedCount hard-coded
// to 0. Homework has its own page, so it is excluded here.
// ponytail: POST below still creates legacy `assessments` rows; no screen calls it.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get('classSubjectId');

    const filters = [eq(assessmentDefinitions.tenantId, tenantId), ne(assessmentDefinitions.type, 'homework')];
    if (classSubjectId) {
      filters.push(eq(assessmentDefinitions.classSubjectId, classSubjectId));
    }

    const counts = db
      .select({
        definitionId: assessmentOutcomes.assessmentDefinitionId,
        graded: sql<number>`count(*) filter (where ${assessmentOutcomes.status} in ('graded', 'exempted', 'absent'))`.as('graded'),
        published: sql<number>`count(*) filter (where ${assessmentOutcomes.moderationState} = 'published')`.as('published'),
      })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.tenantId, tenantId))
      .groupBy(assessmentOutcomes.assessmentDefinitionId)
      .as('counts');

    const rows = await db
      .select({
        id: assessmentDefinitions.id,
        title: assessmentDefinitions.title,
        type: assessmentDefinitions.type,
        assessmentDate: assessmentDefinitions.createdAt,
        className: classes.name,
        subjectName: subjects.name,
        gradedCount: sql<number>`coalesce(${counts.graded}, 0)::int`,
        publishedCount: sql<number>`coalesce(${counts.published}, 0)::int`,
      })
      .from(assessmentDefinitions)
      .leftJoin(classSubjects, and(eq(assessmentDefinitions.classSubjectId, classSubjects.id), eq(classSubjects.tenantId, tenantId)))
      .leftJoin(classes, and(eq(classSubjects.classId, classes.id), eq(classes.tenantId, tenantId)))
      .leftJoin(subjects, and(eq(classSubjects.subjectId, subjects.id), eq(subjects.tenantId, tenantId)))
      .leftJoin(counts, eq(counts.definitionId, assessmentDefinitions.id))
      .where(and(...filters))
      .orderBy(desc(assessmentDefinitions.createdAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
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
