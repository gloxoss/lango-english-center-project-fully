import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getMoroccanMention, isValidGrade } from '@/libs/grading/moroccan-grade-engine';
import { db } from '@/libs/DB';
import { assessmentResults, user } from '@/models/Schema';

const gradeEntryItemSchema = z.object({
  studentId: z.string().min(1),
  score: z.number().min(0).max(20),
  feedback: z.string().trim().max(500).optional(),
}).strict();

const batchGradeEntrySchema = z.object({
  assessmentId: z.string().uuid(),
  grades: z.array(gradeEntryItemSchema).min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');

    const filters = [eq(assessmentResults.tenantId, tenantId)];
    if (assessmentId) {
      filters.push(eq(assessmentResults.assessmentId, assessmentId));
    }

    const rows = await db
      .select({
        id: assessmentResults.id,
        assessmentId: assessmentResults.assessmentId,
        studentId: assessmentResults.studentId,
        studentName: user.name,
        score: assessmentResults.finalPercentage,
        gradeCode: assessmentResults.gradeCode,
        feedback: assessmentResults.feedback,
      })
      .from(assessmentResults)
      .innerJoin(user, eq(assessmentResults.studentId, user.id))
      .where(and(...filters));

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, batchGradeEntrySchema);

    const savedResults = await db.transaction(async (tx) => {
      const insertedList = [];
      for (const item of body.grades) {
        if (!isValidGrade(item.score)) {
          continue;
        }

        const mention = getMoroccanMention(item.score);

        // Delete previous grade entry for this student and assessment
        await tx
          .delete(assessmentResults)
          .where(
            and(
              eq(assessmentResults.tenantId, tenantId),
              eq(assessmentResults.assessmentId, body.assessmentId),
              eq(assessmentResults.studentId, item.studentId),
            ),
          );

        const [inserted] = await tx
          .insert(assessmentResults)
          .values({
            tenantId,
            assessmentId: body.assessmentId,
            studentId: item.studentId,
            finalPercentage: String(item.score),
            gradeCode: mention,
            feedback: item.feedback || null,
          })
          .returning();

        insertedList.push(inserted);
      }
      return insertedList;
    });

    recordAudit(context, 'update', 'assessment_results', body.assessmentId, {
      count: body.grades.length,
    });

    return NextResponse.json({
      success: true,
      data: savedResults,
      message: `Notes enregistrées pour ${body.grades.length} élève(s) (/20).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
