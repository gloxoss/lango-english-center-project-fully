import type { SubjectCoefficient } from './filiere-structure';
import { describe, expect, it } from 'vitest';
import {
  coefficientMap,
  cycleAllowsFiliere,
  DEFAULT_COEFFICIENT,
  filiereIsAssignable,
  resolveCoefficient,

  totalWeight,
  validateCoefficientSet,
} from './filiere-structure';

describe('cycleAllowsFiliere', () => {
  it('allows a filière on a class of the same cycle', () => {
    expect(cycleAllowsFiliere('lycee', 'lycee').allowed).toBe(true);
  });

  it('refuses a lycée filière on a collège class', () => {
    // The damage this prevents: the filière's coefficients would compute a
    // moyenne against subjects those students do not take.
    const result = cycleAllowsFiliere('lycee', 'college');

    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.code).toBe('FILIERE_CYCLE_MISMATCH');
    expect(result.allowed === false && result.message).toContain('Collège');
  });

  it('leaves an unrestricted filière unrestricted', () => {
    // Every row is cycle-less straight after the migration; rejecting them all
    // would break schools that already assigned filières.
    expect(cycleAllowsFiliere(null, 'college').allowed).toBe(true);
    expect(cycleAllowsFiliere(undefined, 'college').allowed).toBe(true);
  });

  it('does not block a class whose cycle is simply unrecorded', () => {
    expect(cycleAllowsFiliere('lycee', null).allowed).toBe(true);
  });
});

describe('filiereIsAssignable', () => {
  it('accepts an active filière', () => {
    expect(filiereIsAssignable({ isActive: true }).allowed).toBe(true);
  });

  it('refuses an archived one', () => {
    const result = filiereIsAssignable({ isActive: false });

    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.code).toBe('FILIERE_INACTIVE');
  });
});

describe('resolveCoefficient', () => {
  const maths = 'subj-maths';
  const philo = 'subj-philo';
  const filiere = coefficientMap([
    { subjectId: maths, coefficient: 7, isCore: true },
  ]);

  it('prefers the filière coefficient over the class one', () => {
    // The whole reason the table exists: Maths counts 7 in Sciences Maths, and
    // that rule should not have to be retyped into every class.
    const resolved = resolveCoefficient(maths, filiere, 3);

    expect(resolved.coefficient).toBe(7);
    expect(resolved.isCore).toBe(true);
    expect(resolved.source).toBe('filiere');
  });

  it('falls back to the class coefficient for a subject the filière omits', () => {
    const resolved = resolveCoefficient(philo, filiere, 2);

    expect(resolved.coefficient).toBe(2);
    expect(resolved.isCore).toBe(false);
    expect(resolved.source).toBe('class-subject');
  });

  it('falls back to 1 when neither says anything', () => {
    expect(resolveCoefficient(philo, filiere, null).coefficient).toBe(DEFAULT_COEFFICIENT);
    expect(resolveCoefficient(philo, filiere, undefined).source).toBe('default');
  });

  it('works with no filière coefficients at all', () => {
    const resolved = resolveCoefficient(maths, coefficientMap([]), 4);

    expect(resolved.coefficient).toBe(4);
    expect(resolved.source).toBe('class-subject');
  });
});

describe('validateCoefficientSet', () => {
  const ok: SubjectCoefficient[] = [
    { subjectId: 'a', coefficient: 7, isCore: true },
    { subjectId: 'b', coefficient: 3, isCore: false },
  ];

  it('accepts a well-formed set', () => {
    expect(validateCoefficientSet(ok)).toEqual([]);
  });

  it('rejects an empty set', () => {
    expect(validateCoefficientSet([]).map(i => i.code)).toEqual(['EMPTY_COEFFICIENT_SET']);
  });

  it('rejects a duplicate subject, where one weight would silently win', () => {
    const issues = validateCoefficientSet([
      { subjectId: 'a', coefficient: 7, isCore: true },
      { subjectId: 'a', coefficient: 3, isCore: false },
    ]);

    expect(issues.map(i => i.code)).toContain('DUPLICATE_SUBJECT');
  });

  it('rejects a non-positive coefficient, which would drop the subject silently', () => {
    for (const bad of [0, -2]) {
      const issues = validateCoefficientSet([{ subjectId: 'a', coefficient: bad, isCore: true }]);

      expect(issues.map(i => i.code)).toContain('INVALID_COEFFICIENT');
    }
  });

  it('rejects NaN rather than letting it poison the average', () => {
    const issues = validateCoefficientSet([{ subjectId: 'a', coefficient: Number.NaN, isCore: true }]);

    expect(issues.map(i => i.code)).toContain('INVALID_COEFFICIENT');
  });

  it('requires at least one matière principale', () => {
    const issues = validateCoefficientSet([{ subjectId: 'a', coefficient: 3, isCore: false }]);

    expect(issues.map(i => i.code)).toContain('NO_CORE_SUBJECT');
  });
});

describe('totalWeight', () => {
  it('sums the weights, which is the denominator of the moyenne', () => {
    expect(totalWeight([
      { subjectId: 'a', coefficient: 7, isCore: true },
      { subjectId: 'b', coefficient: 3, isCore: false },
      { subjectId: 'c', coefficient: 2.5, isCore: false },
    ])).toBe(12.5);
  });

  it('is zero for an empty set', () => {
    expect(totalWeight([])).toBe(0);
  });
});
