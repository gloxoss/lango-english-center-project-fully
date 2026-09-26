import { and, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getTeacherClassSubjectPairs } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { calculateClassRanks, calculateMoroccanAverage, getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { classes, classSections, classSubjects, subjects, user } from '@/models/Schema';

// ponytail: no per-assessment/per-subject coefficient exists in the schema
// (assessmentPlanCriteria weighted rubrics were deliberately skipped when
// grade entry was built - see MIGRATION-NOTES.md) - each assessment counts
// equally (coefficient 1) toward a student's average in this subject.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get('classSubjectId');

    if (!classSubjectId) {
      return NextResponse.json({ success: false, message: 'classSubjectId requis.' }, { status: 400 });
    }

    const [classSubject] = await db
      .select({ id: classSubjects.id, classId: classSubjects.classId, className: classes.name, subjectName: subjects.name })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(eq(classSubjects.id, classSubjectId), eq(classSubjects.tenantId, tenantId)))
      .limit(1);

    if (!classSubject) {
      return NextResponse.json({ success: false, message: 'Matière de classe introuvable.' }, { status: 404 });
    }

    // A teacher may only read the results of a subject they currently teach:
    // the class-subject id is client-supplied, so without this check any
    // teacher could read every class's ranked roster (names + averages) by
    // iterating the picker. school_admin keeps the whole-school view.
    if (context.role === 'teacher') {
      const pairs = await getTeacherClassSubjectPairs(tenantId, context.userId);
      const assigned = [...pairs].some(pair => pair.endsWith(`|${classSubjectId}`));
      if (!assigned) {
        return NextResponse.json(
          { success: false, message: 'Vous ne pouvez consulter que les résultats de vos propres matières.' },
          { status: 403 },
        );
      }
    }

    const roster = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .innerJoin(classSections, eq(user.classSectionId, classSections.id))
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(classSections.classId, classSubject.classId)));

    const studentIds = roster.map(s => s.id);
    let resultRows: { studentId: string; title: string; score20: number }[] = [];
    if (studentIds.length > 0) {
      const outcomeRows = await db
        .select({
          studentId: assessmentOutcomes.studentId,
          title: assessmentDefinitions.title,
          normalizedScore: assessmentOutcomes.normalizedScore,
        })
        .from(assessmentOutcomes)
        .innerJoin(
          assessmentDefinitions,
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id),
        )
        .where(and(
          eq(assessmentDefinitions.classSubjectId, classSubjectId),
          eq(assessmentOutcomes.tenantId, tenantId),
          inArray(assessmentOutcomes.studentId, studentIds),
          eq(assessmentOutcomes.status, 'graded'),
          sql`${assessmentOutcomes.normalizedScore} is not null`,
        ));
      resultRows = outcomeRows
        .filter(r => r.normalizedScore !== null)
        .map(r => ({
          studentId: r.studentId,
          title: r.title,
          score20: Number(r.normalizedScore),
        }));
    }

    const byStudent = new Map<string, { title: string; grade: number }[]>();
    for (const row of resultRows) {
      const list = byStudent.get(row.studentId) ?? [];
      list.push({ title: row.title, grade: row.score20 });
      byStudent.set(row.studentId, list);
    }

    const nameById = new Map(roster.map(s => [s.id, s.name]));
    const studentAverages = Array.from(byStudent.entries()).map(([studentId, grades]) => {
      const { generalAverage } = calculateMoroccanAverage(
        grades.map(g => ({ subjectId: studentId, subjectName: g.title, grade: g.grade, coefficient: 1 })),
      );
      return { studentId, name: nameById.get(studentId) ?? studentId, generalAverage };
    });

    const ranked = calculateClassRanks(studentAverages).map(r => ({
      ...r,
      name: nameById.get(r.studentId) ?? r.studentId,
      mention: getMoroccanMention(r.generalAverage),
    }));

    const classAverage = studentAverages.length > 0
      ? Math.round((studentAverages.reduce((sum, s) => sum + s.generalAverage, 0) / studentAverages.length) * 100) / 100
      : 0;
    const passingCount = studentAverages.filter(s => s.generalAverage >= 10).length;
    const atRiskCount = studentAverages.filter(s => s.generalAverage < 10).length;

    const mentionCounts: Record<string, number> = { 'Très Bien': 0, 'Bien': 0, 'Assez Bien': 0, 'Passable': 0, 'Insuffisant': 0 };
    for (const r of ranked) {
      mentionCounts[r.mention] = (mentionCounts[r.mention] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        className: classSubject.className,
        subjectName: classSubject.subjectName,
        rosterSize: roster.length,
        gradedCount: studentAverages.length,
        classAverage,
        passingCount,
        atRiskCount,
        bestStudent: ranked[0] ?? null,
        mentionCounts,
        ranking: ranked,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
