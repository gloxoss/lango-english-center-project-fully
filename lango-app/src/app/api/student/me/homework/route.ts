import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireStudentContext } from '@/features/student/api/guard';
import { HomeworkService } from '@/features/assessment/services/homework-service';

// GET /api/student/me/homework — published homework assigned to the session student.
// Enforces student session and tenant isolation.
// Delegates to HomeworkService.getHomeworkForStudent for audience matching.

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const data = await HomeworkService.getHomeworkForStudent(tenantId, studentId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
