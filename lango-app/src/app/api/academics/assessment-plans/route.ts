import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { assessmentPlanCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentPlans, classSubjects, gradingScales } from '@/models/Schema';

const DEFAULT_GRADING_SCALE_NAME = 'Standard /20';

// ponytail: there's no grading-scale management UI in this pass - Moroccan
// K-12 grading is a single /20 score per assessment (see
// src/libs/grading/moroccan-grade-engine.ts), not a scale editor. This just
// guarantees the NOT NULL gradingScaleId FK on assessmentPlans has something
// valid to point at, one row per tenant, created lazily on first use.
async function ensureDefaultGradingScale(tenantId: string): Promise<string> {
  const [existing] = await db
    .select({ id: gradingScales.id })
    .from(gradingScales)
    .where(and(eq(gradingScales.tenantId, tenantId), eq(gradingScales.name, DEFAULT_GRADING_SCALE_NAME)))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [created] = await db
    .insert(gradingScales)
    .values({ tenantId, name: DEFAULT_GRADING_SCALE_NAME, description: 'Barème national marocain sur 20.' })
    .returning({ id: gradingScales.id });
  return created!.id;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get('classSubjectId');

    const filters = [eq(assessmentPlans.tenantId, tenantId)];
    if (classSubjectId) {
      filters.push(eq(assessmentPlans.classSubjectId, classSubjectId));
    }

    const rows = await db.select().from(assessmentPlans).where(and(...filters));

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
    const body = await parseJson(request, assessmentPlanCreateSchema);

    const [classSubject] = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(and(eq(classSubjects.id, body.classSubjectId), eq(classSubjects.tenantId, tenantId)))
      .limit(1);
    if (!classSubject) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La matière de classe indiquée n\'existe pas pour cet établissement.');
    }

    const gradingScaleId = await ensureDefaultGradingScale(tenantId);

    const [inserted] = await db
      .insert(assessmentPlans)
      .values({ tenantId, name: body.name, classSubjectId: body.classSubjectId, gradingScaleId })
      .returning();

    recordAudit(context, 'create', 'assessment_plan', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Plan d\'évaluation créé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
