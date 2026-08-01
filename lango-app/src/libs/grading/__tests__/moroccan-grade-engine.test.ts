import { describe, expect, it } from 'vitest';
import {
  calculateClassRanks,
  calculateMoroccanAverage,
  getMoroccanMention,
  isValidGrade,
} from '../moroccan-grade-engine';

describe('Moroccan K-12 Grade Engine (/20 scale)', () => {
  it('validates grades strictly within [0, 20]', () => {
    expect(isValidGrade(0)).toBe(true);
    expect(isValidGrade(15.5)).toBe(true);
    expect(isValidGrade(20)).toBe(true);
    expect(isValidGrade(-1)).toBe(false);
    expect(isValidGrade(20.5)).toBe(false);
    expect(isValidGrade(NaN)).toBe(false);
  });

  it('determines correct Moroccan mentions based on national thresholds', () => {
    expect(getMoroccanMention(17.5)).toBe('Très Bien');
    expect(getMoroccanMention(16.0)).toBe('Très Bien');
    expect(getMoroccanMention(14.5)).toBe('Bien');
    expect(getMoroccanMention(12.5)).toBe('Assez Bien');
    expect(getMoroccanMention(10.5)).toBe('Passable');
    expect(getMoroccanMention(9.75)).toBe('Insuffisant');
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

  it('handles failing average (< 10.00 / 20)', () => {
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

  it('calculates class rank order correctly', () => {
    const students = [
      { studentId: 'std1', generalAverage: 12.5 },
      { studentId: 'std2', generalAverage: 17.8 },
      { studentId: 'std3', generalAverage: 14.2 },
    ];

    const ranks = calculateClassRanks(students);

    expect(ranks[0]).toEqual({
      studentId: 'std2',
      generalAverage: 17.8,
      rank: 1,
      totalStudents: 3,
    });
    expect(ranks[1]).toEqual({
      studentId: 'std3',
      generalAverage: 14.2,
      rank: 2,
      totalStudents: 3,
    });
    expect(ranks[2]).toEqual({
      studentId: 'std1',
      generalAverage: 12.5,
      rank: 3,
      totalStudents: 3,
    });
  });
});
