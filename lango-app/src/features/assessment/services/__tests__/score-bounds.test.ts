import { beforeEach, describe, expect, it, vi } from 'vitest';

// The "no mark above the maximum" rule used to exist only in the marksheet UI,
// so the grading APIs stored 155/20 or -3 as given. The marksheet also wrote
// row by row, so one bad mark left the rows before it saved.

const selectLimit = vi.fn();

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) })),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const { assertScoreInRange, OutcomeService } = await import('@/features/assessment/services/outcome-service');
const { ExamMasterService } = await import('@/features/assessment/services/exam-master-service');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertScoreInRange', () => {
  it('accepts 0, the maximum and a missing score', () => {
    expect(() => assertScoreInRange(0, 20)).not.toThrow();
    expect(() => assertScoreInRange(20, 20)).not.toThrow();
    expect(() => assertScoreInRange(15.5, 20)).not.toThrow();
    expect(() => assertScoreInRange(undefined, 20)).not.toThrow();
    expect(() => assertScoreInRange(null, 20)).not.toThrow();
  });

  it('rejects a mark above the maximum, a negative mark and NaN', () => {
    for (const bad of [155, 20.01, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertScoreInRange(bad, 20)).toThrowError(expect.objectContaining({ code: 'SCORE_OUT_OF_RANGE', status: 422 }));
    }
  });

  it('uses the paper maximum, not /20', () => {
    expect(() => assertScoreInRange(35, 40)).not.toThrow();
    expect(() => assertScoreInRange(41, 40)).toThrow();
  });
});

describe('marksheet batch', () => {
  it('writes nothing when one mark in the batch is out of range', async () => {
    selectLimit.mockResolvedValueOnce([{ maximumScore: '20' }]);
    const record = vi.spyOn(OutcomeService, 'recordOutcome');

    await expect(ExamMasterService.saveMarksheetGrid({
      tenantId: 't1',
      assessmentDefinitionId: 'def-1',
      markerId: 'teacher-1',
      marks: [
        { studentId: 's1', rawScore: 12 },
        { studentId: 's2', rawScore: 155 },
        { studentId: 's3', rawScore: 9 },
      ],
    })).rejects.toMatchObject({ code: 'SCORE_OUT_OF_RANGE' });

    expect(record).not.toHaveBeenCalled();
  });
});
