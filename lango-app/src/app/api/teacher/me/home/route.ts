import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireTeacherContext } from '@/features/teacher/api/guard';
import {
  listTeacherClasses,
  listTeacherSessions,
  teacherTodayWeekday,
} from '@/features/teacher/server/teacher-portal';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// GET /api/teacher/me/home — the teacher self-service home aggregate. The
// session user is the teacher (user row with role='teacher'); every query is
// scoped by teacherId + tenantId so a client can never read outside its own
// teaching assignments. Widgets degrade independently on error.
//
// The schedule and classes come from the canonical sources (published
// class_schedule_slots + current class/subject assignments); see
// features/teacher/server/teacher-portal.ts.

export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;

    const [me] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId)))
      .limit(1);

    const [today, classesList] = await Promise.all([
      listTeacherSessions(tenantId, teacherId, teacherTodayWeekday()),
      listTeacherClasses(tenantId, teacherId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profile: me ? { name: me.name, email: me.email } : null,
        today,
        classes: classesList,
        widgets: {
          classesToday: today.length,
          myClasses: classesList.length,
          students: classesList.reduce((sum, c) => sum + c.students, 0),
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
