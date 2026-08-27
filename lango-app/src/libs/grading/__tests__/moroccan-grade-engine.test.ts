import { describe, expect, it } from 'vitest';
import {
  calculateAnnualAverage,
  calculateClassRanks,
  calculateMoroccanAverage,
  getMoroccanMention,
  isValidGrade,
} from '../moroccan-grade-engine';

describe('Moroccan K-12 Grade Engine (/20 scale) (T14)', () => {
  it('validates grades strictly within [0, 20]', () => {
    expect(isValidGrade(0)).toBe(true);
    expect(isValidGrade(0.0)).toBe(true);
    expect(isValidGrade(10)).toBe(true);
    expect(isValidGrade(15.5)).toBe(true);
    expect(isValidGrade(20)).toBe(true);
    expect(isValidGrade(20.0)).toBe(true);

    expect(isValidGrade(-0.01)).toBe(false);
    expect(isValidGrade(-1)).toBe(false);
    expect(isValidGrade(20.01)).toBe(false);
    expect(isValidGrade(25)).toBe(false);
    expect(isValidGrade(NaN)).toBe(false);
    expect(isValidGrade(Infinity)).toBe(false);
  });

  it('determines correct Moroccan mentions and pass/fail boundaries', () => {
    expect(getMoroccanMention(20.0)).toBe('Très Bien');
    expect(getMoroccanMention(16.0)).toBe('Très Bien');
    expect(getMoroccanMention(15.99)).toBe('Bien');
    expect(getMoroccanMention(14.0)).toBe('Bien');
    expect(getMoroccanMention(13.99)).toBe('Assez Bien');
    expect(getMoroccanMention(12.0)).toBe('Assez Bien');
    expect(getMoroccanMention(11.99)).toBe('Passable');
    expect(getMoroccanMention(10.0)).toBe('Passable');
    expect(getMoroccanMention(9.99)).toBe('Insuffisant');
    expect(getMoroccanMention(0.0)).toBe('Insuffisant');
  });

  it('calculates weighted average correctly with subject coefficients', () => {
    const subjects = [
      { subjectId: 's1', subjectName: 'Maths', grade: 16.0, coefficient: 4 }, // 64
      { subjectId: 's2', subjectName: 'Physique', grade: 14.0, coefficient: 3 }, // 42
      { subjectId: 's3', subjectName: 'Français', grade: 12.0, coefficient: 2 }, // 24
      { subjectId: 's4', subjectName: 'Arabe', grade: 15.0, coefficient: 2 }, // 30
    ];
    // Total weighted = 64 + 42 + 24 + 30 = 160
    // Total coeffs = 4 + 3 + 2 + 2 = 11
    // Average = 160 / 11 = 14.5454... -> 14.55

    const result = calculateMoroccanAverage(subjects);

    expect(result.generalAverage).toBe(14.55);
    expect(result.totalWeightedScore).toBe(160);
    expect(result.totalCoefficients).toBe(11);
    expect(result.mention).toBe('Bien');
    expect(result.status).toBe('Admis');
    expect(result.isPassing).toBe(true);
  });

  it('handles failing average (< 10.00 / 20) with Ajourné status', () => {
    const subjects = [
      { subjectId: 's1', subjectName: 'Maths', grade: 8.0, coefficient: 4 },
      { subjectId: 's2', subjectName: 'Arabe', grade: 9.0, coefficient: 2 },
    ];
    // Total weighted = 32 + 18 = 50
    // Total coeffs = 6
    // Avg = 50 / 6 = 8.33

    const result = calculateMoroccanAverage(subjects);

    expect(result.generalAverage).toBe(8.33);
    expect(result.mention).toBe('Insuffisant');
    expect(result.status).toBe('Ajourné');
    expect(result.isPassing).toBe(false);
  });

  it('handles excused/exempt subjects without distorting weighted coefficients', () => {
    const subjects = [
      { subjectId: 's1', subjectName: 'Maths', grade: 15.0, coefficient: 4 }, // 60
      { subjectId: 's2', subjectName: 'Sport (Exempté)', grade: 0.0, coefficient: 2, isExempt: true }, // Excused medical
      { subjectId: 's3', subjectName: 'Arabe', grade: 15.0, coefficient: 2 }, // 30
    ];
    // Active weighted: 60 + 30 = 90
    // Active coeffs: 4 + 2 = 6
    // Average: 90 / 6 = 15.00

    const result = calculateMoroccanAverage(subjects);
    expect(result.generalAverage).toBe(15.0);
    expect(result.totalCoefficients).toBe(6);
    expect(result.status).toBe('Admis');
    expect(result.mention).toBe('Bien');
  });

  it('calculates class rank order and handles ties (ex-aequo) correctly', () => {
    const students = [
      { studentId: 'std1', generalAverage: 12.5 },
      { studentId: 'std2', generalAverage: 17.5 },
      { studentId: 'std3', generalAverage: 17.5 }, // Tie for rank 1
      { studentId: 'std4', generalAverage: 14.0 },
    ];

    const ranks = calculateClassRanks(students);

    expect(ranks[0]).toEqual({
      studentId: 'std2',
      generalAverage: 17.5,
      rank: 1,
      totalStudents: 4,
    });
    expect(ranks[1]).toEqual({
      studentId: 'std3',
      generalAverage: 17.5,
      rank: 1, // Ex-aequo with std2
      totalStudents: 4,
    });
    expect(ranks[2]).toEqual({
      studentId: 'std4',
      generalAverage: 14.0,
      rank: 3,
      totalStudents: 4,
    });
    expect(ranks[3]).toEqual({
      studentId: 'std1',
      generalAverage: 12.5,
      rank: 4,
      totalStudents: 4,
    });
  });

  it('aggregates annual averages across semesters with custom weights', () => {
    const terms = [
      { termName: 'Semestre 1', average: 14.0, weight: 1 },
      { termName: 'Semestre 2', average: 16.0, weight: 1 },
    ];
    // Annual = (14 + 16) / 2 = 15.00

    const annual = calculateAnnualAverage(terms);
    expect(annual.generalAverage).toBe(15.0);
    expect(annual.status).toBe('Admis');
    expect(annual.mention).toBe('Bien');
  });
});
