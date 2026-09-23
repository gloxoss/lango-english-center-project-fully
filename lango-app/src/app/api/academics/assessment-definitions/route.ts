import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

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
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const rows = await db
      .select({ id: assessmentDefinitions.id, title: assessmentDefinitions.title, type: assessmentDefinitions.type })
      .from(assessmentDefinitions)
      .where(and(eq(assessmentDefinitions.tenantId, tenantId), inArray(assessmentDefinitions.type, [...EXAM_TYPES])))
      .orderBy(asc(assessmentDefinitions.title));

    return NextResponse.json({ success: true, data: rows });
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

    const [inserted] = await db
      .insert(assessmentDefinitions)
      .values({
        tenantId,
        title: body.title,
        type: body.type,
        description: body.description ?? null,
        maximumScore: body.maximumScore ? body.maximumScore.toFixed(2) : '20.00',
        coefficient: body.coefficient ? body.coefficient.toFixed(2) : '1.00',
        passMark: body.passMark ? body.passMark.toFixed(2) : '10.00',
        status: 'published',
      })
      .returning();

    recordAudit(context, 'create', 'assessment_definition', inserted!.id, { title: body.title });
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
