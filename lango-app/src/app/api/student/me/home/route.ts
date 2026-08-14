import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  announcements,
  attendance,
  classSections,
  classScheduleSlots,
  classes,
  mediums,
  sections,
  subjects,
  subjectTeachers,
  user,
} from '@/models/Schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/home — the student self-service home aggregate. The
// session user is the student (user row with role='student'); placement, today's
// schedule, enrolled subjects, announcements and own attendance are all scoped
// by studentId + tenantId. A client can never read another student's data.

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const [me] = await db
      .select({
        name: user.name,
        email: user.email,
        classSectionId: user.classSectionId,
        className: classes.name,
        sectionName: sections.name,
        mediumName: mediums.name,
      })
      .from(user)
      .leftJoin(classSections, eq(user.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .leftJoin(mediums, eq(classSections.mediumId, mediums.id))
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    const myClassSectionId = me?.classSectionId ?? null;

    const todayKey = WEEKDAYS[new Date().getDay() - 1] ?? 'monday';
    const todayDate = new Date().toISOString().slice(0, 10);

    // Today's classes — class-section-keyed schedule, joined to teacher name.
    const todayRows = myClassSectionId
      ? await db
          .select({
            startTime: classScheduleSlots.startTime,
            endTime: classScheduleSlots.endTime,
            roomLabel: classScheduleSlots.roomLabel,
            teacherName: user.name,
          })
          .from(classScheduleSlots)
          .leftJoin(user, eq(classScheduleSlots.teacherId, user.id))
          .where(
            and(
              eq(classScheduleSlots.tenantId, tenantId),
              eq(classScheduleSlots.classSectionId, myClassSectionId),
              eq(classScheduleSlots.dayOfWeek, todayKey),
            ),
          )
          .orderBy(classScheduleSlots.startTime)
      : [];

    // Enrolled subjects for the student's class section.
    const subjectRows = myClassSectionId
      ? await db
          .select({ subjectName: subjects.name })
          .from(subjectTeachers)
          .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
          .where(
            and(
              eq(subjectTeachers.tenantId, tenantId),
              eq(subjectTeachers.classSectionId, myClassSectionId),
            ),
          )
      : [];

    const subjectNames = Array.from(new Set(subjectRows.map((r) => r.subjectName)));

    // Announcements: school-wide, student-role, or this class section's own.
    const announcementRows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        publishedAt: announcements.publishedAt,
      })
      .from(announcements)
      .where(
        and(
          eq(announcements.tenantId, tenantId),
          isNotNull(announcements.publishedAt),
          or(
            eq(announcements.targetRole, 'student'),
            myClassSectionId ? eq(announcements.targetClassSectionId, myClassSectionId) : isNull(announcements.targetClassSectionId),
          ),
        ),
      )
      .orderBy(announcements.publishedAt);

    // Own attendance — status counts (voided rows excluded) + today's status.
    const attendanceRows = await db
      .select({ status: attendance.status, count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, studentId),
          eq(attendance.isVoided, false),
        ),
      )
      .groupBy(attendance.status);

    const summary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const r of attendanceRows) {
      const s = r.status as keyof typeof summary;
      if (s in summary) summary[s] = Number(r.count ?? 0);
      summary.total += Number(r.count ?? 0);
    }

    const [todayRecord] = await db
      .select({ status: attendance.status })
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, studentId),
          eq(attendance.date, todayDate),
          eq(attendance.isVoided, false),
        ),
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        profile: me ? { name: me.name, email: me.email } : null,
        placement: myClassSectionId
          ? {
              classSectionId: myClassSectionId,
              name: `${me?.className ?? ''} ${me?.sectionName ?? ''}`.trim(),
              medium: me?.mediumName ?? null,
            }
          : null,
        today: todayRows.map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          room: r.roomLabel,
          teacher: r.teacherName,
        })),
        subjects: subjectNames,
        announcements: announcementRows.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          publishedAt: a.publishedAt,
        })),
        attendance: summary,
        todayStatus: todayRecord?.status ?? null,
        widgets: {
          classesToday: todayRows.length,
          mySubjects: subjectNames.length,
          present: summary.present,
          late: summary.late,
          absent: summary.absent,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
