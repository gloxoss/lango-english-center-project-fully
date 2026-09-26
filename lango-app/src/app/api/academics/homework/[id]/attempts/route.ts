import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant , type RequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { HomeworkService } from '@/features/assessment/services/homework-service';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { classes, classSubjects } from '@/models/Schema';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';

// Roster of submissions for one homework (teacher correction inbox).
/** Campus lock: homework lives on the campus of the class behind its subject. */
async function assertHomeworkCampus(context: RequestContext, tenantId: string, homeworkId: string) {
  const [campus] = await db
    .select({ branchId: classes.branchId })
    .from(assessmentDefinitions)
    .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
    .leftJoin(classes, eq(classSubjects.classId, classes.id))
    .where(and(eq(assessmentDefinitions.id, homeworkId), eq(assessmentDefinitions.tenantId, tenantId)))
    .limit(1);
  assertBranchScope(context, campus?.branchId ?? null);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(_req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { id } = await params;
    await assertHomeworkCampus(context, tenantId, id);
    const attempts = await HomeworkService.listHomeworkAttempts(tenantId, id);
    return NextResponse.json({ success: true, data: attempts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
