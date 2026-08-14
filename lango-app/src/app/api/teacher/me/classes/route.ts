import { and, eq, inArray, isNull, gte, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSections, classTeachers, classes, sections, subjects, subjectTeachers, user } from '@/models/Schema';
import { requireTeacherContext } from '@/features/teacher/api/guard';

// GET /api/teacher/me/classes — the session teacher's class sections with their
// subject list and live student roster. Scoped by teacherId + tenantId.

export async function GET(request: Request) {
  try {
    const ctx = await requireTeacherContext(request);
    const tenantId = ctx.tenantId as string;
    const teacherId = ctx.userId;
    const today = new Date().toISOString().slice(0, 10);

    const classRows = await db
      .select({
        classSectionId: classSections.id,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(classTeachers)
      .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(
        and(
          eq(classTeachers.tenantId, tenantId),
          eq(classTeachers.teacherId, teacherId),
          eq(classTeachers.status, 'active'),
          or(isNull(classTeachers.endsOn), gte(classTeachers.endsOn, today)),
        ),
      )
      .orderBy(classes.name, sections.name);

    const sectionIds = classRows.map((c) => c.classSectionId);

    const subjectRows = sectionIds.length
      ? await db
          .select({ classSectionId: subjectTeachers.classSectionId, subjectName: subjects.name })
          .from(subjectTeachers)
          .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
          .where(
            and(
              eq(subjectTeachers.tenantId, tenantId),
              eq(subjectTeachers.teacherId, teacherId),
              inArray(subjectTeachers.classSectionId, sectionIds),
            ),
          )
      : [];

    const studentsRows = sectionIds.length
      ? await db
          .select({ classSectionId: user.classSectionId, name: user.name })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              inArray(user.classSectionId, sectionIds),
            ),
          )
          .orderBy(user.name)
      : [];

    const rosterBySection = new Map<string, string[]>();
    for (const s of studentsRows) {
      if (!s.classSectionId) continue;
      const arr = rosterBySection.get(s.classSectionId) ?? [];
      arr.push(s.name);
      rosterBySection.set(s.classSectionId, arr);
    }

    const subjectBySection = new Map<string, string[]>();
    for (const s of subjectRows) {
      const arr = subjectBySection.get(s.classSectionId) ?? [];
      if (!arr.includes(s.subjectName)) arr.push(s.subjectName);
      subjectBySection.set(s.classSectionId, arr);
    }

    return NextResponse.json({
      success: true,
      data: {
        classes: classRows.map((c) => ({
          classSectionId: c.classSectionId,
          name: `${c.className} ${c.sectionName}`.trim(),
          subjects: subjectBySection.get(c.classSectionId) ?? [],
          students: rosterBySection.get(c.classSectionId) ?? [],
        })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
