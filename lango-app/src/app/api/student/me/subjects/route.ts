import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  classSections,
  classSubjects,
  subjects,
  subjectTeachers,
  user,
} from '@/models/Schema';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { requireStudentContext } from '@/features/student/api/guard';
import { getPublishedResultsForStudent } from '@/features/assessment/services/published-results';
import { HomeworkService } from '@/features/assessment/services/homework-service';
import { casablancaTodayIso } from '@/libs/finance/today';

// GET /api/student/me/subjects — the subjects enrolled for the session
// student's class section.
// Enriched with:
//   - coefficient (from class_subjects)
//   - provisionalAverage20 (from published grades, null if no grade)
//   - openHomework (count of homework due today or later)
// All computed in one pass with strict tenant isolation.

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

    if (!classSectionId) {
      return NextResponse.json({ success: true, data: { subjects: [] } });
    }

    // 1. Enrolled subjects and teachers for this section
    const subjectTeacherRows = await db
      .select({
        subjectId: subjects.id,
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
      .orderBy(subjects.name);

    // 2. Fetch classId to get coefficients from class_subjects
    const [section] = await db
      .select({ classId: classSections.classId })
      .from(classSections)
      .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    const coefficientsBySubjectId = new Map<string, number>();
    if (section?.classId) {
      const csRows = await db
        .select({
          subjectId: classSubjects.subjectId,
          coefficient: classSubjects.coefficient,
        })
        .from(classSubjects)
        .where(
          and(
            eq(classSubjects.classId, section.classId),
            eq(classSubjects.tenantId, tenantId),
          ),
        );
      for (const cs of csRows) {
        coefficientsBySubjectId.set(cs.subjectId, Number(cs.coefficient) || 1);
      }
    }

    // 3. Published grades for provisional average in one pass
    const results = await getPublishedResultsForStudent(tenantId, studentId);
    const scoresBySubjectId = new Map<string, number[]>();
    const scoresBySubjectName = new Map<string, number[]>();

    for (const r of results) {
      if (r.status === 'graded') {
        const score = r.normalizedScore != null
          ? Number(r.normalizedScore)
          : (r.rawScore != null && r.maximumScore && Number(r.maximumScore) > 0
            ? (Number(r.rawScore) / Number(r.maximumScore)) * 20
            : null);
        if (score != null && Number.isFinite(score)) {
          if (r.subjectId) {
            const list = scoresBySubjectId.get(r.subjectId) ?? [];
            list.push(score);
            scoresBySubjectId.set(r.subjectId, list);
          }
          if (r.subjectName) {
            const list = scoresBySubjectName.get(r.subjectName) ?? [];
            list.push(score);
            scoresBySubjectName.set(r.subjectName, list);
          }
        }
      }
    }

    // 4. Homework for open homework count in one pass
    const homeworkList = await HomeworkService.getHomeworkForStudent(tenantId, studentId);
    const hwIds = homeworkList.map((h) => h.id);

    const hwSubjectMap = new Map<string, string>();
    if (hwIds.length > 0) {
      const hwDefs = await db
        .select({
          id: assessmentDefinitions.id,
          subjectId: classSubjects.subjectId,
        })
        .from(assessmentDefinitions)
        .innerJoin(
          classSubjects,
          and(
            eq(assessmentDefinitions.classSubjectId, classSubjects.id),
            eq(classSubjects.tenantId, tenantId),
          ),
        )
        .where(
          and(
            eq(assessmentDefinitions.tenantId, tenantId),
            inArray(assessmentDefinitions.id, hwIds),
          ),
        );
      for (const hd of hwDefs) {
        if (hd.subjectId) {
          hwSubjectMap.set(hd.id, hd.subjectId);
        }
      }
    }

    const testNow = request.headers.get('x-test-now');
    const todayDateStr = testNow ? testNow.slice(0, 10) : casablancaTodayIso();
    const startOfTodayMs = new Date(`${todayDateStr}T00:00:00Z`).getTime();

    const openHwCountBySubjectId = new Map<string, number>();
    for (const hw of homeworkList) {
      const isDueTodayOrLater = !hw.closeAt || new Date(hw.closeAt).getTime() >= startOfTodayMs;
      if (isDueTodayOrLater) {
        const subjId = hwSubjectMap.get(hw.id);
        if (subjId) {
          openHwCountBySubjectId.set(subjId, (openHwCountBySubjectId.get(subjId) ?? 0) + 1);
        }
      }
    }

    // Combine enriched fields for each subject
    const enrichedSubjects = subjectTeacherRows.map((row) => {
      const coef = coefficientsBySubjectId.get(row.subjectId) ?? 1;

      const scores = scoresBySubjectId.get(row.subjectId)
        ?? scoresBySubjectName.get(row.subjectName)
        ?? [];

      const provisionalAverage20 = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;

      const openHomework = openHwCountBySubjectId.get(row.subjectId) ?? 0;

      return {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        teacherName: row.teacherName,
        coefficient: coef,
        provisionalAverage20,
        openHomework,
      };
    });

    return NextResponse.json({ success: true, data: { subjects: enrichedSubjects } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
