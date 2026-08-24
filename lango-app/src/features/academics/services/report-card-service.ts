import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { calculateClassRanks, calculateMoroccanAverage, getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import { assessmentPlans, assessmentResults, assessments, classes, classSections, classSubjects, sections, subjects, user } from '@/models/Schema';

export type ReportCardSubject = {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  average: number;
  assessmentCount: number;
};

export type ReportCard = {
  student: { id: string; name: string; matricule: string | null; className: string | null };
  subjects: ReportCardSubject[];
  generalAverage: number;
  mention: string | null;
  rank: number | null;
  classSize: number;
};

/**
 * Computes the real Moroccan-scale bulletin for every student in a class
 * section in a single pass. Subject weighting uses classSubjects.coefficient
 * (Maths counts more than Sport); ranks are the real class-wide ordering.
 */
export async function getClassReportCards(
  tenantId: string,
  classSectionId: string,
): Promise<{ classLabel: string | null; cards: ReportCard[] }> {
  const [sectionInfo] = await db
    .select({ className: classes.name, sectionName: sections.name })
    .from(classSections)
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);

  const classLabel = sectionInfo
    ? `${sectionInfo.className ?? ''}${sectionInfo.sectionName ? ` ${sectionInfo.sectionName}` : ''}`.trim() || null
    : null;

  const roster = await db
    .select({ id: user.id, name: user.name, matricule: user.matricule })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, classSectionId)));
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

  const cards = roster.map((member) => {
    const subjectMap = bySubjectByStudent.get(member.id) ?? new Map<string, { subjectName: string; coefficient: number; scores: number[] }>();
    const thisStudentRank = ranked.find(r => r.studentId === member.id);
    const subjectsBreakdown: ReportCardSubject[] = Array.from(subjectMap.entries()).map(([subjectId, s]) => ({
      subjectId,
      subjectName: s.subjectName,
      coefficient: s.coefficient,
      average: Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100,
      assessmentCount: s.scores.length,
    }));

    return {
      student: {
        id: member.id,
        name: member.name,
        matricule: member.matricule ?? null,
        className: classLabel,
      },
      subjects: subjectsBreakdown,
      generalAverage: thisStudentRank?.generalAverage ?? 0,
      mention: thisStudentRank ? getMoroccanMention(thisStudentRank.generalAverage) : null,
      rank: thisStudentRank?.rank ?? null,
      classSize: roster.length,
    };
  });

  return { classLabel, cards };
}
