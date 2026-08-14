import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import { HomeworkService } from '@/features/assessment/services/homework-service';

// GET /api/guardian/me/children/[relationshipId]/overview — the child overview:
// identity + placement, the rights this relationship grants, and a summary block
// that later phases keep wiring (attendance / balance / nextEvent fill in as
// their portals land; missing keys stay null, never fabricated).
type RouteParams = { params: Promise<{ relationshipId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId);

    const [student] = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        className: user.className,
        level: user.level,
      })
      .from(user)
      .where(eq(user.id, auth.studentId))
      .limit(1);
    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Enfant introuvable.');
    }

    const [publishedRow] = await db
      .select({ n: count() })
      .from(assessmentOutcomes)
      .innerJoin(
        assessmentDefinitions,
        eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id),
      )
      .where(and(
        eq(assessmentOutcomes.tenantId, ctx.tenantId as string),
        eq(assessmentOutcomes.studentId, auth.studentId),
        eq(assessmentOutcomes.moderationState, 'published'),
        inArray(assessmentOutcomes.status, ['graded', 'exempted', 'absent']),
      ));

    const homework = await HomeworkService.getHomeworkForStudent(ctx.tenantId as string, auth.studentId);
    const now = Date.now();
    const openHomework = homework.filter((h) => {
      if (h.submission && h.submission.status === 'graded') return false;
      if (h.closeAt && new Date(h.closeAt).getTime() <= now) return false;
      return true;
    }).length;

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          matricule: student.matricule,
          className: student.className,
          level: student.level,
        },
        rights: auth.rights,
        isPrimaryContact: auth.isPrimaryContact,
        isFinanciallyResponsible: auth.isFinanciallyResponsible,
        custodyRestriction: auth.custodyRestriction,
        sensitiveContactHidden: auth.sensitiveContactHidden,
        summary: {
          publishedResults: publishedRow?.n ?? 0,
          openHomework,
          attendance: null,
          balance: null,
          nextEvent: null,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
