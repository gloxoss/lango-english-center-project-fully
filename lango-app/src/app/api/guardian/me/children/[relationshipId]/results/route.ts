import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';
import { getPublishedResultsForStudent } from '@/features/assessment/services/published-results';

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

    const rows = await getPublishedResultsForStudent(ctx.tenantId as string, auth.studentId);

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
