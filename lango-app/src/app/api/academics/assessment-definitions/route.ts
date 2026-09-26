import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentAudiences, assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSubjectPairs } from '@/libs/api/teacher-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, classSubjects } from '@/models/Schema';

// Épreuves (exam papers) the Exam Master can schedule and mark. Homework is
// deliberately excluded — it has its own flow. This powers the searchable
// épreuve dropdowns in the Exam Master roster & schedule tabs (review 10.6).
const EXAM_TYPES = ['paper_exam', 'online_exam', 'quiz', 'oral', 'practical', 'project'] as const;

const createDefinitionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  type: z.enum(EXAM_TYPES).default('paper_exam'),
  description: z.string().trim().max(1000).optional(),
  maximumScore: z.number().min(1).max(100).optional(),
  coefficient: z.number().min(0.25).max(20).optional(),
  passMark: z.number().min(0).max(100).optional(),
  // Without a class subject the épreuve has no subject (no report-card average)
  // and no audience (an empty marksheet roster), so nobody can grade it.
  classSubjectId: z.string().uuid().optional(),
  classSectionIds: z.array(z.string().uuid()).min(1).max(50).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const rows = await db
      .select({
        id: assessmentDefinitions.id,
        title: assessmentDefinitions.title,
        type: assessmentDefinitions.type,
        status: assessmentDefinitions.status,
      })
      .from(assessmentDefinitions)
      .where(and(eq(assessmentDefinitions.tenantId, tenantId), inArray(assessmentDefinitions.type, [...EXAM_TYPES])))
      .orderBy(asc(assessmentDefinitions.title));

    const defIds = rows.map(r => r.id);
    const outcomeCounts = defIds.length > 0
      ? await db
          .select({
            definitionId: assessmentOutcomes.assessmentDefinitionId,
            moderationState: assessmentOutcomes.moderationState,
            count: count(),
          })
          .from(assessmentOutcomes)
          .where(and(
            eq(assessmentOutcomes.tenantId, tenantId),
            inArray(assessmentOutcomes.assessmentDefinitionId, defIds),
          ))
          .groupBy(assessmentOutcomes.assessmentDefinitionId, assessmentOutcomes.moderationState)
      : [];

    const statsByDef = new Map<string, { published: number; draft: number; total: number }>();
    for (const r of outcomeCounts) {
      const cur = statsByDef.get(r.definitionId) ?? { published: 0, draft: 0, total: 0 };
      const c = Number(r.count);
      cur.total += c;
      if (r.moderationState === 'published') {
        cur.published += c;
      } else {
        cur.draft += c;
      }
      statsByDef.set(r.definitionId, cur);
    }

    const data = rows.map(r => {
      const stats = statsByDef.get(r.id) ?? { published: 0, draft: 0, total: 0 };
      const isPublished = stats.total > 0 ? (stats.published > 0 && stats.draft === 0) : r.status === 'published';
      return {
        ...r,
        publishedCount: stats.published,
        draftCount: stats.draft,
        totalMarks: stats.total,
        isPublished,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createDefinitionSchema);
    if (body.classSectionIds && !body.classSubjectId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'classSectionIds requiert classSubjectId.');
    }

    // Audience = class sections of the subject's class; a teacher only gets the
    // sections where they teach this subject.
    let audienceSectionIds: string[] = [];
    if (body.classSubjectId) {
      const [cs] = await db
        .select({ classId: classSubjects.classId })
        .from(classSubjects)
        .where(and(eq(classSubjects.id, body.classSubjectId), eq(classSubjects.tenantId, tenantId)))
        .limit(1);
      if (!cs) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Matière de classe introuvable pour cet établissement.');
      }
      const classSectionRows = await db
        .select({ id: classSections.id })
        .from(classSections)
        .where(and(eq(classSections.classId, cs.classId), eq(classSections.tenantId, tenantId)));
      let allowed = new Set(classSectionRows.map(r => r.id));
      if (context.role === 'teacher') {
        const pairs = await getTeacherClassSubjectPairs(tenantId, context.userId);
        allowed = new Set([...allowed].filter(id => pairs.has(`${id}|${body.classSubjectId}`)));
        if (allowed.size === 0) {
          throw new ApiError(403, 'FORBIDDEN', 'Vous n\'enseignez pas cette matière dans cette classe.');
        }
      }
      if (body.classSectionIds) {
        const outside = body.classSectionIds.filter(id => !allowed.has(id));
        if (outside.length > 0) {
          throw new ApiError(context.role === 'teacher' ? 403 : 422, 'INVALID_REFERENCE', 'Section hors de la classe ou non autorisée.');
        }
        audienceSectionIds = [...new Set(body.classSectionIds)];
      } else {
        audienceSectionIds = [...allowed];
      }
    }

    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(assessmentDefinitions)
        .values({
          tenantId,
          title: body.title,
          type: body.type,
          description: body.description ?? null,
          classSubjectId: body.classSubjectId ?? null,
          maximumScore: body.maximumScore ? body.maximumScore.toFixed(2) : '20.00',
          coefficient: body.coefficient ? body.coefficient.toFixed(2) : '1.00',
          passMark: body.passMark ? body.passMark.toFixed(2) : '10.00',
          status: 'published',
        })
        .returning();
      if (audienceSectionIds.length > 0) {
        await tx.insert(assessmentAudiences).values(audienceSectionIds.map(sectionId => ({
          assessmentDefinitionId: row!.id,
          sectionId,
        })));
      }
      return row!;
    });

    recordAudit(context, 'create', 'assessment_definition', inserted.id, { title: body.title, classSubjectId: body.classSubjectId ?? null, sections: audienceSectionIds.length });
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
