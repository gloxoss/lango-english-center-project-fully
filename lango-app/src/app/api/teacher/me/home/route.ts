import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classSections,
  classTeachers,
  classes,
  rooms,
  sections,
  studentGroups,
  subjects,
  subjectTeachers,
  timetableSlots,
  user,
} from '@/models/Schema';
import { requireTeacherContext } from '@/features/teacher/api/guard';

// GET /api/teacher/me/home — the teacher self-service home aggregate. The
// session user is the teacher (user row with role='teacher'); every query is
// scoped by teacherId + tenantId so a client can never read outside its own
// teaching assignments. Widgets degrade independently on error.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

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

    const todayDate = new Date().toISOString().slice(0, 10);
    // Today's schedule — timetableSlots scoped to this teacher.
    const todayKey = WEEKDAYS[new Date().getDay()] ?? 'monday';
    const todayRows = await db
      .select({
        startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime,
        groupName: studentGroups.name,
        roomName: rooms.name,
      })
      .from(timetableSlots)
      .innerJoin(studentGroups, eq(timetableSlots.studentGroupId, studentGroups.id))
      .innerJoin(rooms, eq(timetableSlots.roomId, rooms.id))
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.teacherId, teacherId),
          eq(timetableSlots.dayOfWeek, todayKey),
        ),
      )
      .orderBy(timetableSlots.startTime);

    // My class sections — primary class-teacher rows that are still active,
    // joined to class + section names; subjects from subject-teacher rows.
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
          or(isNull(classTeachers.endsOn), gte(classTeachers.endsOn, todayDate)),
        ),
      );

    const subjectRows = await db
      .select({
        classSectionId: subjectTeachers.classSectionId,
        subjectName: subjects.name,
      })
      .from(subjectTeachers)
      .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
      .where(
        and(
          eq(subjectTeachers.tenantId, tenantId),
          eq(subjectTeachers.teacherId, teacherId),
        ),
      );

    const subjectBySection = new Map<string, string[]>();
    for (const s of subjectRows) {
      const arr = subjectBySection.get(s.classSectionId) ?? [];
      if (!arr.includes(s.subjectName)) arr.push(s.subjectName);
      subjectBySection.set(s.classSectionId, arr);
    }

    const sectionIds = classRows.map((c) => c.classSectionId);
    const studentCounts = new Map<string, number>();
    if (sectionIds.length > 0) {
      const rows = await db
        .select({ classSectionId: user.classSectionId, n: sql<number>`count(*)::int` })
        .from(user)
        .where(
          and(
            eq(user.tenantId, tenantId),
            eq(user.role, 'student'),
            inArray(user.classSectionId, sectionIds),
          ),
        )
        .groupBy(user.classSectionId);
      for (const r of rows) {
        if (!r.classSectionId) continue;
        studentCounts.set(r.classSectionId, Number(r.n ?? 0));
      }
    }

    const classesList = classRows.map((c) => ({
      classSectionId: c.classSectionId,
      name: `${c.className} ${c.sectionName}`.trim(),
      subjects: subjectBySection.get(c.classSectionId) ?? [],
      students: studentCounts.get(c.classSectionId) ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        profile: me ? { name: me.name, email: me.email } : null,
        today: todayRows.map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          group: r.groupName,
          room: r.roomName,
        })),
        classes: classesList,
        widgets: {
          classesToday: todayRows.length,
          myClasses: classesList.length,
          students: classesList.reduce((a, c) => a + c.students, 0),
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
