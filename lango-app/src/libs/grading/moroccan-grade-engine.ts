/**
 * Moroccan K-12 Grade Engine (/20 Scale)
 * Strictly enforces Moroccan national education grading standards, weighted subject averages,
 * mentions, and pass/fail thresholds.
 */

export type SubjectGradeInput = {
  subjectId: string;
  subjectName: string;
  grade: number; // 0 to 20
  coefficient: number; // > 0
  isExempt?: boolean; // If true, subject is excused/exempted and excluded from average
};

export type MentionType =
  | 'Très Bien'
  | 'Bien'
  | 'Assez Bien'
  | 'Passable'
  | 'Insuffisant';

export type PassStatus = 'Admis' | 'Ajourné';

export type CalculationResult = {
  generalAverage: number; // Round to 2 decimals
  totalWeightedScore: number;
  totalCoefficients: number;
  mention: MentionType;
  status: PassStatus;
  isPassing: boolean;
};

export type StudentRankResult = {
  studentId: string;
  generalAverage: number;
  rank: number;
  totalStudents: number;
};

/**
 * Validates whether a single grade is within valid Moroccan limits (0 to 20).
 */
export function isValidGrade(grade: number): boolean {
  return typeof grade === 'number' && !isNaN(grade) && grade >= 0 && grade <= 20;
}

/**
 * Calculates the Mention based on the Moroccan national scale.
 */
export function getMoroccanMention(average: number): MentionType {
  if (average >= 16.0) return 'Très Bien';
  if (average >= 14.0) return 'Bien';
  if (average >= 12.0) return 'Assez Bien';
  if (average >= 10.0) return 'Passable';
  return 'Insuffisant';
}

/**
 * Computes the General Weighted Average (Moyenne Générale) for a list of subject grades.
 * M = sum(Grade * Coefficient) / sum(Coefficient)
 * Exempt subjects (isExempt: true) are omitted from both numerator and denominator.
 */
export function calculateMoroccanAverage(subjects: SubjectGradeInput[]): CalculationResult {
  if (!subjects || subjects.length === 0) {
    return {
      generalAverage: 0,
      totalWeightedScore: 0,
      totalCoefficients: 0,
      mention: 'Insuffisant',
      status: 'Ajourné',
      isPassing: false,
    };
  }

  let totalWeightedScore = 0;
  let totalCoefficients = 0;

  for (const item of subjects) {
    if (item.isExempt) {
      continue;
    }

    if (!isValidGrade(item.grade)) {
      throw new Error(`Grade non valide pour ${item.subjectName}: ${item.grade}. Doit être entre 0 et 20.`);
    }
    if (typeof item.coefficient !== 'number' || item.coefficient <= 0) {
      throw new Error(`Coefficient non valide pour ${item.subjectName}: ${item.coefficient}. Doit être supérieur à 0.`);
    }

    totalWeightedScore += item.grade * item.coefficient;
    totalCoefficients += item.coefficient;
  }

  const rawAverage = totalCoefficients > 0 ? totalWeightedScore / totalCoefficients : 0;
  // Round to 2 decimal places as per standard Moroccan bulletins
  const generalAverage = Math.round((rawAverage + Number.EPSILON) * 100) / 100;
  const isPassing = generalAverage >= 10.0;
  const mention = getMoroccanMention(generalAverage);
  const status: PassStatus = isPassing ? 'Admis' : 'Ajourné';

  return {
    generalAverage,
    totalWeightedScore: Math.round((totalWeightedScore + Number.EPSILON) * 100) / 100,
    totalCoefficients,
    mention,
    status,
    isPassing,
  };
}

/**
 * Aggregates term/semester averages into an annual general average.
 */
export function calculateAnnualAverage(
  terms: Array<{ termName: string; average: number; weight?: number }>,
): CalculationResult {
  if (!terms || terms.length === 0) {
    return {
      generalAverage: 0,
      totalWeightedScore: 0,
      totalCoefficients: 0,
      mention: 'Insuffisant',
      status: 'Ajourné',
      isPassing: false,
    };
  }

  let totalWeightedScore = 0;
  let totalWeights = 0;

  for (const t of terms) {
    if (!isValidGrade(t.average)) {
      throw new Error(`Moyenne de terme non valide pour ${t.termName}: ${t.average}.`);
    }
    const weight = t.weight && t.weight > 0 ? t.weight : 1;
    totalWeightedScore += t.average * weight;
    totalWeights += weight;
  }

  const rawAverage = totalWeights > 0 ? totalWeightedScore / totalWeights : 0;
  const generalAverage = Math.round((rawAverage + Number.EPSILON) * 100) / 100;
  const isPassing = generalAverage >= 10.0;
  const mention = getMoroccanMention(generalAverage);
  const status: PassStatus = isPassing ? 'Admis' : 'Ajourné';

  return {
    generalAverage,
    totalWeightedScore: Math.round((totalWeightedScore + Number.EPSILON) * 100) / 100,
    totalCoefficients: totalWeights,
    mention,
    status,
    isPassing,
  };
}

/**
 * Calculates class rankings from a list of student averages, handling ties (ex-aequo).
 */
export function calculateClassRanks(
  students: Array<{ studentId: string; generalAverage: number }>,
): StudentRankResult[] {
  const sorted = [...students].sort((a, b) => b.generalAverage - a.generalAverage);
  const totalStudents = students.length;

  let currentRank = 1;
  return sorted.map((st, index) => {
    if (index > 0 && st.generalAverage < sorted[index - 1]!.generalAverage) {
      currentRank = index + 1;
    }
    return {
      studentId: st.studentId,
      generalAverage: st.generalAverage,
      rank: currentRank,
      totalStudents,
    };
  });
}
