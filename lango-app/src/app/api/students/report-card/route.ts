import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAnyCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { calculateClassRanks, calculateMoroccanAverage, getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import { assessmentPlans, assessmentResults, assessments, classes, classSections, classSubjects, sections, subjects, user } from '@/models/Schema';

// GET /api/students/report-card?studentId= — one student's real report card.
// GET /api/students/report-card?classSectionId= — the whole class's bulletins
// (batch generation, computed in a single pass over the class roster).
//
// Per-subject average reuses the same calculateMoroccanAverage the class-results
// route already uses (not a second calculation); subject weighting uses the real
// class_subjects.coefficient so a Moroccan bulletin weights Maths over Sport.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAnyCapability(context, ['grading.read', 'grading.review']);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const classSectionId = searchParams.get('classSectionId');

    if (!studentId && !classSectionId) {
      return NextResponse.json({ success: false, message: 'studentId ou classSectionId requis.' }, { status: 400 });
    }

    // Resolve the target class section. Single-student mode derives it from the
    // student's own assignment; batch mode uses the supplied class section directly.
    let targetClassSectionId: string;
    if (studentId) {
      const [student] = await db
        .select({ classSectionId: user.classSectionId })
        .from(user)
        .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);

      if (!student) {
        return NextResponse.json({ success: false, message: 'Élève introuvable.' }, { status: 404 });
      }
      if (!student.classSectionId) {
        return NextResponse.json({ success: false, message: 'Élève non affecté à une classe.' }, { status: 422 });
      }
      targetClassSectionId = student.classSectionId;
    } else {
      targetClassSectionId = classSectionId!;
    }

    const [sectionInfo] = await db
      .select({ className: classes.name, sectionName: sections.name })
      .from(classSections)
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(classSections.id, targetClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    const classLabel = sectionInfo
      ? `${sectionInfo.className ?? ''}${sectionInfo.sectionName ? ` ${sectionInfo.sectionName}` : ''}`.trim() || null
      : null;

    // Whole class roster, needed to compute real ranks.
    const roster = await db
      .select({ id: user.id, name: user.name, matricule: user.matricule })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, targetClassSectionId)));
    const rosterIds = roster.map(r => r.id);

    const resultRows = await db
      .select({
        studentId: assessmentResults.studentId,
        subjectId: classSubjects.subjectId,
        subjectName: subjects.name,
        coefficient: classSubjects.coefficient,
        title: assessments.title,
        finalPercentage: assessmentResults.finalPercentage,
      })
      .from(assessmentResults)
      .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
      .innerJoin(assessmentPlans, eq(assessments.assessmentPlanId, assessmentPlans.id))
      .innerJoin(classSubjects, eq(assessmentPlans.classSubjectId, classSubjects.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(eq(assessmentResults.tenantId, tenantId), inArray(assessmentResults.studentId, rosterIds)));

    // Per-student, per-subject average (for rank + each student's subject rows).
    const bySubjectByStudent = new Map<string, Map<string, { subjectName: string; coefficient: number; scores: number[] }>>();
    for (const row of resultRows) {
      if (row.finalPercentage === null) {
        continue;
      }
      const studentMap = bySubjectByStudent.get(row.studentId) ?? new Map();
      const entry = studentMap.get(row.subjectId) ?? { subjectName: row.subjectName, coefficient: Number(row.coefficient) || 1, scores: [] };
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
        coefficient: s.coefficient,
      }));
      return { studentId: sid, name: nameById.get(sid) ?? sid, generalAverage: calculateMoroccanAverage(subjectInputs).generalAverage };
    });

    const ranked = calculateClassRanks(classAverages);

    const buildCard = (sid: string) => {
      const member = roster.find(r => r.id === sid);
      const subjectMap = bySubjectByStudent.get(sid) ?? new Map<string, { subjectName: string; coefficient: number; scores: number[] }>();
      const thisStudentRank = ranked.find(r => r.studentId === sid);
      const subjectsBreakdown = Array.from(subjectMap.entries()).map(([subjectId, s]) => ({
        subjectId,
        subjectName: s.subjectName,
        coefficient: s.coefficient,
        average: Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100,
        assessmentCount: s.scores.length,
      }));

      return {
        student: {
          id: sid,
          name: member?.name ?? sid,
          matricule: member?.matricule ?? null,
          className: classLabel,
        },
        subjects: subjectsBreakdown,
        generalAverage: thisStudentRank?.generalAverage ?? 0,
        mention: thisStudentRank ? getMoroccanMention(thisStudentRank.generalAverage) : null,
        rank: thisStudentRank?.rank ?? null,
        classSize: roster.length,
      };
    };

    if (studentId) {
      return NextResponse.json({ success: true, data: buildCard(studentId) });
    }
    return NextResponse.json({ success: true, data: rosterIds.map(buildCard) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
