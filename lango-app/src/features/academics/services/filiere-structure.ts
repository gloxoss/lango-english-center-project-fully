/**
 * Filière rules: which cycle a filière may be used in, and which coefficient
 * applies to a subject for a given filière.
 *
 * Kept free of database access so the arithmetic and the cycle rule can be
 * tested directly. The Moroccan weighted-average formula itself lives in
 * `@/libs/grading/moroccan-grade-engine`; this module decides the weights it is
 * fed.
 */

export type ClassCycle = 'maternelle' | 'primaire' | 'college' | 'lycee';

export const CLASS_CYCLES: ClassCycle[] = ['maternelle', 'primaire', 'college', 'lycee'];

export const CYCLE_LABELS: Record<ClassCycle, string> = {
  maternelle: 'Maternelle',
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

export type FiliereSummary = {
  id: string;
  name: string;
  code: string | null;
  cycle: ClassCycle | null;
  bacSeriesCode: string | null;
  isActive: boolean;
};

export type CycleCheck
  = | { allowed: true }
    | { allowed: false; code: string; message: string };

/**
 * Whether a class in `classCycle` may be assigned this filière.
 *
 * A filière with no cycle set is unrestricted — that is what every existing row
 * is after the migration, and silently rejecting them all would break every
 * school that already assigned filières. Likewise a class with no cycle recorded
 * cannot be checked, so it is allowed rather than blocked on missing data.
 */
export function cycleAllowsFiliere(
  filiereCycle: ClassCycle | null | undefined,
  classCycle: ClassCycle | null | undefined,
): CycleCheck {
  if (!filiereCycle || !classCycle) {
    return { allowed: true };
  }

  if (filiereCycle === classCycle) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'FILIERE_CYCLE_MISMATCH',
    message: `Cette filière est réservée au cycle ${CYCLE_LABELS[filiereCycle]} et ne peut pas être affectée à une classe du cycle ${CYCLE_LABELS[classCycle]}.`,
  };
}

/** An inactive filière must not be attached to new classes. */
export function filiereIsAssignable(filiere: Pick<FiliereSummary, 'isActive'>): CycleCheck {
  if (filiere.isActive) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'FILIERE_INACTIVE',
    message: 'Cette filière est archivée et ne peut plus être affectée à une classe.',
  };
}

export type SubjectCoefficient = {
  subjectId: string;
  coefficient: number;
  isCore: boolean;
};

export type ResolvedCoefficient = {
  subjectId: string;
  coefficient: number;
  isCore: boolean;
  /** Where the weight came from, so a report card can be explained. */
  source: 'filiere' | 'class-subject' | 'default';
};

/** Used when neither the filière nor the class says otherwise. */
export const DEFAULT_COEFFICIENT = 1;

/**
 * Resolves the coefficient for one subject.
 *
 * The filière wins: it is the ministry-level rule, and the whole point of the
 * table is that "Maths counts 7 in Sciences Maths" should not have to be retyped
 * into every Sciences Maths class. The per-class coefficient remains the fallback
 * for subjects a filière does not mention, and for schools with no filières.
 */
export function resolveCoefficient(
  subjectId: string,
  filiereCoefficients: Map<string, SubjectCoefficient>,
  classSubjectCoefficient?: number | null,
): ResolvedCoefficient {
  const fromFiliere = filiereCoefficients.get(subjectId);

  if (fromFiliere) {
    return {
      subjectId,
      coefficient: fromFiliere.coefficient,
      isCore: fromFiliere.isCore,
      source: 'filiere',
    };
  }

  // 0 is not treated as "unset" here — but it is also not a legal coefficient
  // (the DB forbids it), so only null/undefined fall through to the default.
  if (classSubjectCoefficient !== null && classSubjectCoefficient !== undefined) {
    return {
      subjectId,
      coefficient: classSubjectCoefficient,
      isCore: false,
      source: 'class-subject',
    };
  }

  return { subjectId, coefficient: DEFAULT_COEFFICIENT, isCore: false, source: 'default' };
}

export function coefficientMap(rows: SubjectCoefficient[]): Map<string, SubjectCoefficient> {
  return new Map(rows.map(row => [row.subjectId, row]));
}

export type CoefficientSetIssue = { code: string; message: string };

/**
 * Checks a proposed coefficient set before it is saved.
 *
 * These are the mistakes that produce a plausible-looking but wrong moyenne:
 * a duplicate subject (one of the two weights silently wins), a non-positive
 * weight (the subject vanishes from the average), and an empty set attached to a
 * filière that is meant to define weights.
 */
export function validateCoefficientSet(rows: SubjectCoefficient[]): CoefficientSetIssue[] {
  const issues: CoefficientSetIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      code: 'EMPTY_COEFFICIENT_SET',
      message: 'Définissez au moins un coefficient de matière pour cette filière.',
    });
    return issues;
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.subjectId)) {
      issues.push({
        code: 'DUPLICATE_SUBJECT',
        message: 'Une matière ne peut avoir qu\'un seul coefficient par filière.',
      });
    }
    seen.add(row.subjectId);

    if (!Number.isFinite(row.coefficient) || row.coefficient <= 0) {
      issues.push({
        code: 'INVALID_COEFFICIENT',
        message: `Le coefficient doit être strictement positif (reçu : ${row.coefficient}).`,
      });
    }
  }

  if (!rows.some(row => row.isCore)) {
    issues.push({
      code: 'NO_CORE_SUBJECT',
      message: 'Désignez au moins une matière principale pour cette filière.',
    });
  }

  return issues;
}

/** Sum of weights, which is the denominator of the moyenne générale. */
export function totalWeight(rows: SubjectCoefficient[]): number {
  return rows.reduce((sum, row) => sum + row.coefficient, 0);
}
