import type { ExamTermFacts, ExamTermStage } from './exam-term-workflow';
import { describe, expect, it } from 'vitest';
import {
  canPerform,
  checkTransition,
  EXAM_TERM_STAGES,

  isExamTermStage,
  isLegalMove,
  meetsEntryRequirements,
  nextStage,
} from './exam-term-workflow';

/** A term that satisfies every gate, so each test can break exactly one. */
function readyFacts(overrides: Partial<ExamTermFacts> = {}): ExamTermFacts {
  return {
    examHallCount: 3,
    scheduledExamCount: 8,
    unassignedExamCount: 0,
    allocatedSeatCount: 120,
    candidateCount: 120,
    pendingMarkCount: 0,
    allExamsFinished: true,
    ...overrides,
  };
}

describe('isLegalMove', () => {
  it('allows one step forward', () => {
    expect(isLegalMove('setup', 'scheduling').allowed).toBe(true);
    expect(isLegalMove('valuation', 'closed').allowed).toBe(true);
  });

  it('allows one step back, so a mistake can be corrected', () => {
    expect(isLegalMove('active', 'scheduling').allowed).toBe(true);
  });

  it('refuses to skip a stage', () => {
    // Skipping is how a term ends up "active" with nothing scheduled.
    const result = isLegalMove('setup', 'active');

    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.code).toBe('STAGE_SKIPPED');
  });

  it('refuses to jump backwards more than one stage', () => {
    expect(isLegalMove('valuation', 'setup').allowed).toBe(false);
  });

  it('refuses to reopen a closed term', () => {
    const result = isLegalMove('closed', 'valuation');

    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.code).toBe('TERM_CLOSED');
  });

  it('treats a no-op as a refusal rather than a silent success', () => {
    expect(isLegalMove('setup', 'setup').allowed).toBe(false);
  });
});

describe('meetsEntryRequirements', () => {
  it('will not start scheduling without a single exam hall', () => {
    const result = meetsEntryRequirements('scheduling', readyFacts({ examHallCount: 0 }));

    expect(result.allowed === false && result.code).toBe('NO_EXAM_HALLS');
  });

  it('will not go active with nothing scheduled', () => {
    const result = meetsEntryRequirements('active', readyFacts({ scheduledExamCount: 0 }));

    expect(result.allowed === false && result.code).toBe('NO_SCHEDULED_EXAMS');
  });

  it('will not go active while an exam has no hall', () => {
    const result = meetsEntryRequirements('active', readyFacts({ unassignedExamCount: 2 }));

    expect(result.allowed === false && result.code).toBe('EXAMS_WITHOUT_HALL');
  });

  it('will not go active while a candidate has no desk', () => {
    // Discovering this in the room is the failure the gate exists to prevent.
    const result = meetsEntryRequirements('active', readyFacts({ allocatedSeatCount: 118, candidateCount: 120 }));

    expect(result.allowed === false && result.code).toBe('SEATS_INCOMPLETE');
    expect(result.allowed === false && result.message).toContain('2');
  });

  it('does not demand seats when no candidates are registered', () => {
    expect(meetsEntryRequirements('active', readyFacts({ candidateCount: 0, allocatedSeatCount: 0 })).allowed).toBe(true);
  });

  it('will not start correction while an exam is still running', () => {
    const result = meetsEntryRequirements('valuation', readyFacts({ allExamsFinished: false }));

    expect(result.allowed === false && result.code).toBe('EXAMS_IN_PROGRESS');
  });

  it('will not close a term with marks outstanding', () => {
    const result = meetsEntryRequirements('closed', readyFacts({ pendingMarkCount: 4 }));

    expect(result.allowed === false && result.code).toBe('MARKS_PENDING');
    expect(result.allowed === false && result.message).toContain('4');
  });

  it('lets a fully ready term advance at every stage', () => {
    for (const stage of EXAM_TERM_STAGES) {
      expect(meetsEntryRequirements(stage, readyFacts()).allowed).toBe(true);
    }
  });
});

describe('checkTransition', () => {
  it('applies entry requirements when advancing', () => {
    expect(checkTransition('setup', 'scheduling', readyFacts({ examHallCount: 0 })).allowed).toBe(false);
  });

  it('skips entry requirements when rolling back', () => {
    // Rolling back must never be blocked by the very problem being fixed —
    // otherwise a term with unassigned halls is stuck in `active` forever.
    expect(checkTransition('active', 'scheduling', readyFacts({ unassignedExamCount: 5 })).allowed).toBe(true);
  });

  it('still refuses an illegal shape even when every fact is green', () => {
    expect(checkTransition('setup', 'closed', readyFacts()).allowed).toBe(false);
  });
});

describe('canPerform', () => {
  it('permits seat allocation only while scheduling', () => {
    const allowed = EXAM_TERM_STAGES.filter(s => canPerform(s, 'allocate_seats'));

    expect(allowed).toEqual(['scheduling']);
  });

  it('permits mark entry only during correction', () => {
    const allowed = EXAM_TERM_STAGES.filter(s => canPerform(s, 'enter_marks'));

    expect(allowed).toEqual(['valuation']);
  });

  it('freezes everything while exams are being sat', () => {
    const actions = ['edit_term', 'manage_halls', 'schedule_exam', 'allocate_seats', 'enter_marks'] as const;

    for (const action of actions) {
      expect(canPerform('active', action)).toBe(false);
    }
  });

  it('freezes everything once closed', () => {
    expect(canPerform('closed', 'enter_marks')).toBe(false);
    expect(canPerform('closed', 'edit_term')).toBe(false);
  });
});

describe('stage helpers', () => {
  it('walks the stages in order and stops at the end', () => {
    const walked: ExamTermStage[] = ['setup'];
    let current = nextStage('setup');
    while (current) {
      walked.push(current);
      current = nextStage(current);
    }

    expect(walked).toEqual([...EXAM_TERM_STAGES]);
  });

  it('recognises only the five known stages', () => {
    expect(isExamTermStage('valuation')).toBe(true);
    expect(isExamTermStage('archived')).toBe(false);
    expect(isExamTermStage('')).toBe(false);
  });
});
