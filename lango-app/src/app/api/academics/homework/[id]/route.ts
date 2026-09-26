import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant , type RequestContext } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { classes, classSubjects } from '@/models/Schema';
import { eq } from 'drizzle-orm';
import { and } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { HomeworkService } from '@/features/assessment/services/homework-service';

const updateHomeworkSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  maximumScore: z.number().positive().optional(),
  closeAt: z.string().nullable().optional(),
  allowAttachments: z.boolean().optional(),
  attachments: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      size: z.number().optional(),
      type: z.string().optional(),
    })
  ).optional(),
}).strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req, ['school_admin', 'teacher', 'student']);
    const tenantId = requireTenant(context);

    // A student sees only homework their own audience rule shows them (same
    // rule as their list), not any homework in the school by id.
    if (context.role === 'student') {
      const mine = await HomeworkService.getHomeworkForStudent(tenantId, context.userId);
      if (!mine.some((h: { id: string }) => h.id === id)) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Devoir introuvable.' } },
          { status: 404 }
        );
      }
    }

    await assertHomeworkCampus(context, tenantId, id);
    const homework = await HomeworkService.getHomeworkById(tenantId, id);
    if (!homework) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Devoir introuvable.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: homework });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const body = await parseJson(req, updateHomeworkSchema);

    await HomeworkService.updateHomework({
      tenantId,
      homeworkId: id,
      ...body,
    });

    recordAudit(context, 'update', 'homework', id, { title: body.title });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const deleted = await HomeworkService.deleteHomework(tenantId, id);

    recordAudit(context, 'delete', 'homework', id, { title: deleted?.title });

    return NextResponse.json({
      success: true,
      message: 'Devoir supprimé avec succès.',
      data: { id },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
