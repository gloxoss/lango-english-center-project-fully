import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { calculateClassRanks, calculateMoroccanAverage, getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import { passingScoreOnTwenty, type GradingScale } from '@/libs/grading/pass-threshold';
import { getEffectiveValue } from '@/libs/settings/registry';
import { getSectionOutcomes } from '@/features/assessment/services/staff-results';
import { classes, classSections, classSubjects, sections, user } from '@/models/Schema';

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
  /** Decision computed against the tenant's STORED passing threshold (academic.passThreshold), not a hardcoded 10. */
  status: 'Admis' | 'Ajourné' | null;
  /** The /20 threshold this bulletin's decision used, for auditability on the document. */
  passingScoreApplied: number | null;
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
  opts?: { termStart?: string; termEnd?: string },
): Promise<{ classLabel: string | null; cards: ReportCard[] }> {
  // The admission threshold is the tenant's STORED grading policy (edited on
  // /dashboard/academics/grading/policies), normalized onto the /20 scale the
  // bulletins are computed on. Before this read the decision behind every
  // bulletin was a hardcoded 10 no matter what the school configured.
  const [thresholdSetting, scaleSetting, eliminatorySetting] = await Promise.all([
    getEffectiveValue(tenantId, null, 'academic.passThreshold'),
    getEffectiveValue(tenantId, null, 'academic.gradingScale'),
    getEffectiveValue(tenantId, null, 'academic.eliminatoryScore'),
  ]);
  const gradingScale: GradingScale = scaleSetting.value === '100' ? '100' : '20';
  const rawThreshold = Number(thresholdSetting.value);
  const passingScore20 = Number.isFinite(rawThreshold)
    ? passingScoreOnTwenty(rawThreshold, gradingScale)
    : 10;
  // Audit 3, P1-G: the stored eliminatory mark is now APPLIED — a subject
  // average below it makes the student Ajourné even if the weighted average
  // clears the admission threshold.
  const rawEliminatory = Number(eliminatorySetting.value);
  const eliminatoryScore20 = Number.isFinite(rawEliminatory) && rawEliminatory > 0
    ? passingScoreOnTwenty(rawEliminatory, gradingScale)
    : null;

  const [sectionInfo] = await db
    .select({ classId: classSections.classId, className: classes.name, sectionName: sections.name })
    .from(classSections)
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);

  const classLabel = sectionInfo
    ? `${sectionInfo.className ?? ''}${sectionInfo.sectionName ? ` ${sectionInfo.sectionName}` : ''}`.trim() || null
    : null;

  // Audit 3, P0-F: a bulletin is scoped to the requesting class's CURRENT
  // class-subjects (a promoted student's old-year marks carried last year's
  // coefficients) and, when a term window is given, to assessments whose date
  // falls inside it. Without this the average swallowed every mark a student
  // had ever recorded.
  const currentClassId = sectionInfo?.classId ?? null;
  const currentClassSubjects = currentClassId
    ? await db
      .select({ id: classSubjects.id, subjectId: classSubjects.subjectId, coefficient: classSubjects.coefficient })
      .from(classSubjects)
      .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, currentClassId)))
    : [];
  const currentSubjectIds = new Set(currentClassSubjects.map(cs => cs.subjectId));

  const roster = await db
    .select({ id: user.id, name: user.name, matricule: user.matricule })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, classSectionId)));
  const rosterIds = roster.map(r => r.id);
  if (rosterIds.length === 0) {
    return { classLabel, cards: [] };
  }

  const outcomeRows = await getSectionOutcomes(tenantId, classSectionId, {
    termStart: opts?.termStart,
    termEnd: opts?.termEnd,
  });

  // Coefficients ALWAYS come from the current class's class_subjects, keyed by
  // subject — never from whatever historical row the mark was attached to.
  const coefficientBySubject = new Map<string, number>();
  for (const cs of currentClassSubjects) {
    coefficientBySubject.set(cs.subjectId, Number(cs.coefficient) || 1);
  }

  const bySubjectByStudent = new Map<string, Map<string, { subjectName: string; coefficient: number; scores: number[] }>>();
  for (const row of outcomeRows) {
    // GD2 / GD4: Only include graded outcomes that have a normalized score.
    // Exempted and absent (without explicit zero) are excluded from the subject average calculation.
    if (row.status !== 'graded' || row.score20 === null) continue;
    // A mark attached to another class's plan (old year, old section) is not
    // part of this bulletin.
    if (!currentSubjectIds.has(row.subjectId)) continue;
    const studentMap = bySubjectByStudent.get(row.studentId) ?? new Map();
    const entry = studentMap.get(row.subjectId) ?? {
      subjectName: row.subjectName,
      coefficient: coefficientBySubject.get(row.subjectId) ?? row.coefficient ?? 1,
      scores: [],
    };
    // score20 is already on the /20 Moroccan scale.
    entry.scores.push(row.score20);
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
    // P1-G: eliminatory rule — any subject average strictly below the stored
    // eliminatory mark (when one is configured) fails the term.
    const hasEliminatorySubject = eliminatoryScore20 !== null
      && subjectsBreakdown.some(s => s.average < eliminatoryScore20);

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
      status: thisStudentRank
        ? ((thisStudentRank.generalAverage >= passingScore20 && !hasEliminatorySubject) ? 'Admis' as const : 'Ajourné' as const)
        : null,
      passingScoreApplied: thisStudentRank ? passingScore20 : null,
      rank: thisStudentRank?.rank ?? null,
      classSize: roster.length,
    };
  });

  return { classLabel, cards };
}
