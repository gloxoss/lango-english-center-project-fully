import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { HomeworkService } from '@/features/assessment/services/homework-service';

// Roster of submissions for one homework (teacher correction inbox).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(_req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { id } = await params;
    const attempts = await HomeworkService.listHomeworkAttempts(tenantId, id);
    return NextResponse.json({ success: true, data: attempts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
