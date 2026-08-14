import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { subjects, subjectTeachers, user } from '@/models/Schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/subjects — the subjects enrolled for the session
// student's class section, each with the assigning teacher. Scoped by
// studentId + tenantId.

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const [me] = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    const classSectionId = me?.classSectionId ?? null;

    const rows = classSectionId
      ? await db
          .select({
            subjectName: subjects.name,
            teacherName: user.name,
          })
          .from(subjectTeachers)
          .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
          .innerJoin(user, eq(subjectTeachers.teacherId, user.id))
          .where(
            and(
              eq(subjectTeachers.tenantId, tenantId),
              eq(subjectTeachers.classSectionId, classSectionId),
            ),
          )
          .orderBy(subjects.name)
      : [];

    return NextResponse.json({ success: true, data: { subjects: rows } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
