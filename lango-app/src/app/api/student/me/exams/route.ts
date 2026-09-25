import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classSections,
  classSubjects,
  onlineExams,
  subjects,
  user,
} from '@/models/Schema';
import {
  assessmentDefinitions,
  examHalls,
  examSchedules,
  examSeats,
} from '@/features/assessment/models/assessment-schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/exams — exams for the session student.
// Includes published paper/standard exam schedules and online exams.
// Only exams targeting the student's class (via classSection -> class -> classSubjects)
// are returned. Drafts and other classes' exams are strictly excluded.
// Exam seat is scoped to the session student only.
// Split into `upcoming` and `past` with Africa/Casablanca as now.

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

    if (!me?.classSectionId) {
      return NextResponse.json({
        success: true,
        data: { upcoming: [], past: [], onlineExams: [] },
      });
    }

    const [section] = await db
      .select({ classId: classSections.classId })
      .from(classSections)
      .where(and(eq(classSections.id, me.classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!section?.classId) {
      return NextResponse.json({
        success: true,
        data: { upcoming: [], past: [], onlineExams: [] },
      });
    }

    const classSubjRows = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(and(eq(classSubjects.classId, section.classId), eq(classSubjects.tenantId, tenantId)));

    const classSubjectIds = classSubjRows.map((c) => c.id);

    if (classSubjectIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { upcoming: [], past: [], onlineExams: [] },
      });
    }

    const scheduleRows = await db
      .select({
        id: examSchedules.id,
        examTermId: examSchedules.examTermId,
        title: assessmentDefinitions.title,
        subjectId: classSubjects.subjectId,
        subjectName: subjects.name,
        startTime: examSchedules.startTime,
        endTime: examSchedules.endTime,
        hallName: examHalls.name,
        seatNumber: examSeats.seatNumber,
        deskLabel: examSeats.deskLabel,
        candidateNumber: examSeats.candidateNumber,
      })
      .from(examSchedules)
      .innerJoin(
        assessmentDefinitions,
        and(
          eq(examSchedules.assessmentDefinitionId, assessmentDefinitions.id),
          eq(assessmentDefinitions.tenantId, tenantId),
        ),
      )
      .leftJoin(
        classSubjects,
        and(
          eq(assessmentDefinitions.classSubjectId, classSubjects.id),
          eq(classSubjects.tenantId, tenantId),
        ),
      )
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(
        examHalls,
        and(
          eq(examSchedules.examHallId, examHalls.id),
          eq(examHalls.tenantId, tenantId),
        ),
      )
      .leftJoin(
        examSeats,
        and(
          eq(examSeats.examTermId, examSchedules.examTermId),
          eq(examSeats.studentId, studentId),
          eq(examSeats.tenantId, tenantId),
        ),
      )
      .where(
        and(
          eq(examSchedules.tenantId, tenantId),
          eq(examSchedules.status, 'published'),
          inArray(assessmentDefinitions.classSubjectId, classSubjectIds),
        ),
      )
      .orderBy(asc(examSchedules.startTime));

    // Support optional test header x-test-now for deterministic time testing
    const testNow = request.headers.get('x-test-now');
    const now = testNow ? new Date(testNow) : new Date();

    const upcoming: any[] = [];
    const past: any[] = [];

    for (const row of scheduleRows) {
      const item = {
        id: row.id,
        title: row.title,
        subject: row.subjectName ?? null,
        startTime: row.startTime,
        endTime: row.endTime,
        hall: row.hallName ?? null,
        seat: row.seatNumber != null
          ? {
              seatNumber: row.seatNumber,
              deskLabel: row.deskLabel ?? null,
              candidateNumber: row.candidateNumber ?? null,
            }
          : null,
      };

      const isUpcoming = new Date(row.endTime ?? row.startTime).getTime() >= now.getTime();
      if (isUpcoming) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    }

    // Past exams ordered newest first
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Online exams targeting student's class subjects
    const onlineExamRows = await db
      .select({
        id: onlineExams.id,
        title: onlineExams.title,
        durationMinutes: onlineExams.durationMinutes,
        totalMarks: onlineExams.totalMarks,
        startsAt: onlineExams.startsAt,
        endsAt: onlineExams.endsAt,
        subjectName: subjects.name,
      })
      .from(onlineExams)
      .leftJoin(
        classSubjects,
        and(
          eq(onlineExams.classSubjectId, classSubjects.id),
          eq(classSubjects.tenantId, tenantId),
        ),
      )
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(
        and(
          eq(onlineExams.tenantId, tenantId),
          inArray(onlineExams.classSubjectId, classSubjectIds),
        ),
      )
      .orderBy(desc(onlineExams.createdAt));

    const onlineExamsList = onlineExamRows.map((oe) => {
      const start = new Date(oe.startsAt).getTime();
      const end = new Date(oe.endsAt).getTime();
      const nowMs = now.getTime();
      const isOpen = nowMs >= start && nowMs <= end;
      const isExpired = nowMs > end;

      return {
        id: oe.id,
        title: oe.title,
        subject: oe.subjectName ?? null,
        durationMinutes: oe.durationMinutes,
        totalMarks: oe.totalMarks,
        startsAt: oe.startsAt,
        endsAt: oe.endsAt,
        isOpen,
        isExpired,
        takeUrl: `/api/academics/online-exams/${oe.id}/take`,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        upcoming,
        past,
        onlineExams: onlineExamsList,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
