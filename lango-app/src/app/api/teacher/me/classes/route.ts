import { NextResponse } from 'next/server';
import { requireTeacherContext } from '@/features/teacher/api/guard';
import { listTeacherRosters } from '@/features/teacher/server/teacher-portal';
import { apiErrorResponse } from '@/libs/api/errors';

// GET /api/teacher/me/classes — the session teacher's class sections with their
// subject list and live student roster. Scoped by teacherId + tenantId, and by
// the canonical current-assignment scope (homeroom and subject assignments).

export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;

    const classes = await listTeacherRosters(tenantId, teacherId);

    return NextResponse.json({ success: true, data: { classes } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
