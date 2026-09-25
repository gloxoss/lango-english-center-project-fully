import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSections, classSubjects, user } from '@/models/Schema';
import { requireStudentContext } from '@/features/student/api/guard';
import { getPublishedResultsForStudent } from '@/features/assessment/services/published-results';

// GET /api/student/me/results — published results for the session student.
// Student guard enforces student-only session. All queries filtered by tenantId
// and studentId. Unpublished grades, marker IDs, internal notes never reach student.

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const rows = await getPublishedResultsForStudent(tenantId, studentId);

    // Fetch class-subject coefficients for the student's current class section
    const [me] = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    const coefficientBySubjectId = new Map<string, number>();
    if (me?.classSectionId) {
      const [section] = await db
        .select({ classId: classSections.classId })
        .from(classSections)
        .where(and(eq(classSections.id, me.classSectionId), eq(classSections.tenantId, tenantId)))
        .limit(1);

      if (section?.classId) {
        const csRows = await db
          .select({
            subjectId: classSubjects.subjectId,
            coefficient: classSubjects.coefficient,
          })
          .from(classSubjects)
          .where(and(eq(classSubjects.classId, section.classId), eq(classSubjects.tenantId, tenantId)));

        for (const cs of csRows) {
          coefficientBySubjectId.set(cs.subjectId, Number(cs.coefficient) || 1);
        }
      }
    }

    const mappedResults = rows.map((r) => ({
      assessmentId: r.assessmentId,
      title: r.title,
      type: r.type,
      subjectId: r.subjectId,
      subject: r.subjectName ?? null,
      score: r.normalizedScore != null ? Number(r.normalizedScore) : (r.rawScore != null ? Number(r.rawScore) : null),
      maximumScore: r.maximumScoreSnapshot != null ? Number(r.maximumScoreSnapshot) : (r.maximumScore != null ? Number(r.maximumScore) : null),
      grade: r.grade ?? null,
      status: r.status,
      gradedAt: r.gradedAt,
    }));

    const subjectGroups = new Map<string, {
      subjectId: string | null;
      subjectName: string;
      items: typeof rows;
    }>();

    for (const r of rows) {
      const key = r.subjectId ?? r.subjectName ?? 'unknown';
      if (!subjectGroups.has(key)) {
        subjectGroups.set(key, {
          subjectId: r.subjectId,
          subjectName: r.subjectName ?? 'Autre',
          items: [],
        });
      }
      subjectGroups.get(key)!.items.push(r);
    }

    const summary = Array.from(subjectGroups.values()).map((group) => {
      const gradedScores: number[] = [];
      for (const r of group.items) {
        if (r.status === 'graded') {
          const score = r.normalizedScore != null
            ? Number(r.normalizedScore)
            : (r.rawScore != null && r.maximumScore && Number(r.maximumScore) > 0
              ? (Number(r.rawScore) / Number(r.maximumScore)) * 20
              : null);
          if (score != null && Number.isFinite(score)) {
            gradedScores.push(score);
          }
        }
      }

      const provisionalAverage20 = gradedScores.length > 0
        ? Math.round((gradedScores.reduce((sum, val) => sum + val, 0) / gradedScores.length) * 100) / 100
        : null;

      const coefficient = group.subjectId ? (coefficientBySubjectId.get(group.subjectId) ?? 1) : 1;

      return {
        subjectId: group.subjectId,
        subjectName: group.subjectName,
        coefficient,
        count: group.items.length,
        provisionalAverage20,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        results: mappedResults,
        subjects: summary,
        summary,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
