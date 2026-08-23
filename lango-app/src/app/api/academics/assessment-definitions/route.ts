import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';

// Épreuves (exam papers) the Exam Master can schedule and mark. Homework is
// deliberately excluded — it has its own flow. This powers the searchable
// épreuve dropdowns in the Exam Master roster & schedule tabs (review 10.6).
const EXAM_TYPES = ['paper_exam', 'online_exam', 'quiz', 'oral', 'practical', 'project'] as const;

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
