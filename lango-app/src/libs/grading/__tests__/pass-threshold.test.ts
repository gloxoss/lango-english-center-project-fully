import { describe, expect, it } from 'vitest';
import { passingScoreOnTwenty, passingScoreToPercentage } from '@/libs/grading/pass-threshold';
import { calculateMoroccanAverage, type SubjectGradeInput } from '@/libs/grading/moroccan-grade-engine';

// Audit 2026-09-22 P0-3: the stored grading policy must drive both the
// promotions engine (which compares against 0-100 percentages) and the
// report-card decision (computed on /20). One conversion, shared by both.

const subjects = (avg: number): SubjectGradeInput[] => [
  { subjectId: 'math', subjectName: 'Mathématiques', grade: avg, coefficient: 3 },
  { subjectId: 'sport', subjectName: 'EPS', grade: avg, coefficient: 1 },
];

describe('passingScoreToPercentage', () => {
  it('converts the default 10/20 to 50%', () => {
    expect(passingScoreToPercentage(10, '20')).toBe(50);
  });

  it('converts a custom 12/20 threshold to 60%', () => {
    expect(passingScoreToPercentage(12, '20')).toBe(60);
  });

  it('leaves /100 thresholds untouched', () => {
    expect(passingScoreToPercentage(60, '100')).toBe(60);
  });
});

describe('passingScoreOnTwenty', () => {
  it('normalizes a /100 threshold onto /20 for bulletins', () => {
    expect(passingScoreOnTwenty(60, '100')).toBe(12);
  });

  it('keeps a /20 threshold as-is', () => {
    expect(passingScoreOnTwenty(12, '20')).toBe(12);
  });
});

describe('grading policy ↔ promotion decision parity', () => {
  it('a student below the stored threshold is Ajourné on the bulletin AND retained by promotions', () => {
    const passingScore = 12; // stored policy (edited on /grading/policies)
    const pct = passingScoreToPercentage(passingScore, '20'); // what promotions compares against
    const threshold20 = passingScoreOnTwenty(passingScore, '20'); // what the bulletin compares against

    const average = 11; // /20 → 55%
    expect(calculateMoroccanAverage(subjects(average)).generalAverage).toBeCloseTo(average, 2);
    expect(average * 5).toBeLessThan(pct); // promotions: retain
    expect(average).toBeLessThan(threshold20); // bulletin: Ajourné
  });

  it('a student above the stored threshold is Admis on the bulletin AND promoted', () => {
    const passingScore = 12;
    const pct = passingScoreToPercentage(passingScore, '20');
    const threshold20 = passingScoreOnTwenty(passingScore, '20');

    const average = 13; // /20 → 65%
    expect(average * 5).toBeGreaterThanOrEqual(pct); // promotions: promote
    expect(average).toBeGreaterThanOrEqual(threshold20); // bulletin: Admis
  });

  it('supports /100-scale schools symmetrically', () => {
    const pct = passingScoreToPercentage(60, '100');
    const threshold20 = passingScoreOnTwenty(60, '100');
    expect(pct).toBe(60);
    expect(threshold20).toBe(12);
  });
});
