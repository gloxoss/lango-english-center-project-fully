import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSubjects, subjects } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';

// GET /api/guardian/me/children/[relationshipId]/results — the child's results,
// published only. Gate: the relationship must be effective for this guardian
// (404 otherwise) AND grant the academic right (403 otherwise). Publication is
// the authoritative moderation gate: assessmentOutcomes.moderationState must be
// 'published' and status must be a final, non-withheld state. Projection is an
// allowlist — subject/title/type/score/grade — never raw internal fields
// (markerId, sourceReferenceId, revisions).
type RouteParams = { params: Promise<{ relationshipId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { academic: true });

    const rows = await db
      .select({
        assessmentId: assessmentDefinitions.id,
        title: assessmentDefinitions.title,
        type: assessmentDefinitions.type,
        subjectId: classSubjects.subjectId,
        subjectName: subjects.name,
        maximumScore: assessmentDefinitions.maximumScore,
        rawScore: assessmentOutcomes.rawScore,
        normalizedScore: assessmentOutcomes.normalizedScore,
        maximumScoreSnapshot: assessmentOutcomes.maximumScoreSnapshot,
        grade: assessmentOutcomes.grade,
        status: assessmentOutcomes.status,
        gradedAt: assessmentOutcomes.updatedAt,
      })
      .from(assessmentOutcomes)
      .innerJoin(
        assessmentDefinitions,
        eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id),
      )
      .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(
        eq(assessmentOutcomes.tenantId, ctx.tenantId as string),
        eq(assessmentOutcomes.studentId, auth.studentId),
        eq(assessmentOutcomes.moderationState, 'published'),
        inArray(assessmentOutcomes.status, ['graded', 'exempted', 'absent']),
      ))
      .orderBy(assessmentOutcomes.updatedAt);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        assessmentId: r.assessmentId,
        title: r.title,
        type: r.type,
        subject: r.subjectName ?? null,
        score: r.normalizedScore ?? r.rawScore,
        maximumScore: r.maximumScoreSnapshot ?? r.maximumScore,
        grade: r.grade ?? null,
        status: r.status,
        gradedAt: r.gradedAt,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
