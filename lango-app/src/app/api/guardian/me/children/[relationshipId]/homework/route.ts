import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';
import { HomeworkService } from '@/features/assessment/services/homework-service';

// GET /api/guardian/me/children/[relationshipId]/homework — the child's
// homework, audience-matched and published-only (HomeworkService already filters
// to published definitions and matches the child's section/offering/self). The
// relationship must be effective for this guardian (404) and grant the academic
// right (403). The child id comes from the server-resolved relationship, never
// from the client.
type RouteParams = { params: Promise<{ relationshipId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { academic: true });

    const homework = await HomeworkService.getHomeworkForStudent(
      ctx.tenantId as string,
      auth.studentId,
    );

    return NextResponse.json({ success: true, data: homework });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
