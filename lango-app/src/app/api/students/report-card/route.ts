import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { calculateClassRanks, calculateMoroccanAverage, getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import { assessmentPlans, assessmentResults, assessments, classes, classSections, classSubjects, sections, subjects, user } from '@/models/Schema';

// GET /api/students/report-card?studentId= — one student's real report card:
// per-subject average (reusing the same calculateMoroccanAverage the class-results
// route already uses, not a second calculation), overall average, class rank.
// ponytail: no per-assessment/subject coefficient exists in the schema (see
// class-results/route.ts's identical note) - every assessment counts equally.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.read');
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, message: 'studentId requis.' }, { status: 400 });
    }

    const [student] = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        classSectionId: user.classSectionId,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(user)
      .leftJoin(classSections, eq(user.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!student) {
      return NextResponse.json({ success: false, message: 'Élève introuvable.' }, { status: 404 });
    }
    if (!student.classSectionId) {
      return NextResponse.json({ success: false, message: 'Élève non affecté à une classe.' }, { status: 422 });
    }

    // Whole class roster, needed to compute this student's real rank.
    const roster = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, student.classSectionId)));
    const rosterIds = roster.map(r => r.id);

    const resultRows = await db
      .select({
        studentId: assessmentResults.studentId,
        subjectId: classSubjects.subjectId,
        subjectName: subjects.name,
        title: assessments.title,
        finalPercentage: assessmentResults.finalPercentage,
      })
      .from(assessmentResults)
      .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
      .innerJoin(assessmentPlans, eq(assessments.assessmentPlanId, assessmentPlans.id))
      .innerJoin(classSubjects, eq(assessmentPlans.classSubjectId, classSubjects.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(eq(assessmentResults.tenantId, tenantId), inArray(assessmentResults.studentId, rosterIds)));

    // Per-student, per-subject average (for rank + this student's subject rows).
    const bySubjectByStudent = new Map<string, Map<string, { subjectName: string; scores: number[] }>>();
    for (const row of resultRows) {
      if (row.finalPercentage === null) {
        continue;
      }
      const studentMap = bySubjectByStudent.get(row.studentId) ?? new Map();
      const entry = studentMap.get(row.subjectId) ?? { subjectName: row.subjectName, scores: [] };
      entry.scores.push(Number(row.finalPercentage));
      studentMap.set(row.subjectId, entry);
      bySubjectByStudent.set(row.studentId, studentMap);
    }

    const nameById = new Map(roster.map(r => [r.id, r.name]));
    const classAverages = Array.from(bySubjectByStudent.entries()).map(([sid, subjectMap]) => {
      const subjectInputs = Array.from(subjectMap.values()).map(s => ({
        subjectId: s.subjectName,
        subjectName: s.subjectName,
        grade: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
        coefficient: 1,
      }));
      return { studentId: sid, name: nameById.get(sid) ?? sid, generalAverage: calculateMoroccanAverage(subjectInputs).generalAverage };
    });

    const ranked = calculateClassRanks(classAverages);
    const thisStudentRank = ranked.find(r => r.studentId === studentId);

    const subjectMap = bySubjectByStudent.get(studentId) ?? new Map<string, { subjectName: string; scores: number[] }>();
    const subjectsBreakdown = Array.from(subjectMap.entries()).map(([subjectId, s]) => ({
      subjectId,
      subjectName: s.subjectName,
      average: Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100,
      assessmentCount: s.scores.length,
    }));

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          matricule: student.matricule,
          className: student.className ? `${student.className}${student.sectionName ? ` ${student.sectionName}` : ''}` : null,
        },
        subjects: subjectsBreakdown,
        generalAverage: thisStudentRank?.generalAverage ?? 0,
        mention: thisStudentRank ? getMoroccanMention(thisStudentRank.generalAverage) : null,
        rank: thisStudentRank?.rank ?? null,
        classSize: roster.length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
