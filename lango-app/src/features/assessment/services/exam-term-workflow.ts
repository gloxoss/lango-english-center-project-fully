/**
 * The exam-term state machine.
 *
 * `exam_terms.status` has always documented five stages in a comment, but
 * nothing moved a term between them and nothing checked them, so seats could be
 * allocated after an exam had been sat and marks entered before it had been
 * scheduled. This module is the missing half: which stage follows which, what
 * has to be true to advance, and which operations each stage permits.
 *
 * Pure by design — it takes a snapshot of facts rather than reading the
 * database, so every rule can be tested without a term existing.
 */

export const EXAM_TERM_STAGES = ['setup', 'scheduling', 'active', 'valuation', 'closed'] as const;

export type ExamTermStage = (typeof EXAM_TERM_STAGES)[number];

export const STAGE_LABELS: Record<ExamTermStage, string> = {
  setup: 'Préparation',
  scheduling: 'Planification',
  active: 'Épreuves en cours',
  valuation: 'Correction',
  closed: 'Clôturé',
};

export function isExamTermStage(value: string): value is ExamTermStage {
  return (EXAM_TERM_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: ExamTermStage): number {
  return EXAM_TERM_STAGES.indexOf(stage);
}

/**
 * Facts about a term, gathered once by the caller.
 * Everything here is a count so the rules stay comparisons, not queries.
 */
export type ExamTermFacts = {
  examHallCount: number;
  scheduledExamCount: number;
  /** Scheduled exams whose slot has no hall assigned. */
  unassignedExamCount: number;
  allocatedSeatCount: number;
  /** Students expected to sit at least one exam in this term. */
  candidateCount: number;
  /** Marks still not entered across the term's exams. */
  pendingMarkCount: number;
  /** True once every scheduled slot's end time is in the past. */
  allExamsFinished: boolean;
};

export type TransitionCheck
  = | { allowed: true }
    | { allowed: false; code: string; message: string };

/**
 * Which operations each stage permits. Anything not listed for a stage is
 * refused there — that refusal is the whole point of the feature.
 */
export type ExamTermAction
  = | 'edit_term'
    | 'manage_halls'
    | 'schedule_exam'
    | 'allocate_seats'
    | 'enter_marks'
    | 'publish_results';

const ALLOWED_ACTIONS: Record<ExamTermStage, ExamTermAction[]> = {
  // Halls and term details are shaped before anything is scheduled against them.
  setup: ['edit_term', 'manage_halls'],
  // Scheduling is the only window where seating may be recomputed: regenerating
  // seats deletes and rebuilds every allocation, which would hand candidates a
  // different desk mid-exam if it were allowed later.
  scheduling: ['edit_term', 'manage_halls', 'schedule_exam', 'allocate_seats'],
  // Exams are being sat. The timetable is frozen; nothing may move under a
  // candidate already in the room.
  active: [],
  // Papers are being marked.
  valuation: ['enter_marks'],
  // Terminal. Results stand as published.
  closed: [],
};

export function canPerform(stage: ExamTermStage, action: ExamTermAction): boolean {
  return ALLOWED_ACTIONS[stage].includes(action);
}

export function assertCanPerform(stage: ExamTermStage, action: ExamTermAction): TransitionCheck {
  if (canPerform(stage, action)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'STAGE_FORBIDS_ACTION',
    message: `Cette opération n'est pas autorisée à l'étape « ${STAGE_LABELS[stage]} ».`,
  };
}

/**
 * Whether the shape of a move is legal, ignoring readiness.
 *
 * Forward is one step at a time — skipping a stage is how a term ends up
 * "active" with nothing scheduled. Backward is one step too, so a mistake can be
 * corrected, except out of `closed`: published results are not walked back by a
 * status change.
 */
export function isLegalMove(from: ExamTermStage, to: ExamTermStage): TransitionCheck {
  if (from === to) {
    return { allowed: false, code: 'NO_CHANGE', message: 'Le contrôle est déjà à cette étape.' };
  }

  if (from === 'closed') {
    return {
      allowed: false,
      code: 'TERM_CLOSED',
      message: 'Un contrôle clôturé ne peut pas être rouvert par un changement d\'étape.',
    };
  }

  const delta = stageIndex(to) - stageIndex(from);

  if (delta > 1) {
    return {
      allowed: false,
      code: 'STAGE_SKIPPED',
      message: `Passez d'abord par l'étape « ${STAGE_LABELS[EXAM_TERM_STAGES[stageIndex(from) + 1]!]} ».`,
    };
  }

  if (delta < -1) {
    return {
      allowed: false,
      code: 'STAGE_SKIPPED',
      message: 'Revenez une étape à la fois.',
    };
  }

  return { allowed: true };
}

/**
 * What must be true to *enter* a stage. Only checked when moving forward — going
 * back to fix a problem must never be blocked by that same problem.
 */
export function meetsEntryRequirements(to: ExamTermStage, facts: ExamTermFacts): TransitionCheck {
  switch (to) {
    case 'scheduling':
      if (facts.examHallCount === 0) {
        return {
          allowed: false,
          code: 'NO_EXAM_HALLS',
          message: 'Déclarez au moins une salle d\'examen avant de planifier les épreuves.',
        };
      }
      return { allowed: true };

    case 'active':
      if (facts.scheduledExamCount === 0) {
        return {
          allowed: false,
          code: 'NO_SCHEDULED_EXAMS',
          message: 'Aucune épreuve n\'est planifiée pour ce contrôle.',
        };
      }
      if (facts.unassignedExamCount > 0) {
        return {
          allowed: false,
          code: 'EXAMS_WITHOUT_HALL',
          message: `${facts.unassignedExamCount} épreuve(s) n'ont pas de salle affectée.`,
        };
      }
      if (facts.candidateCount > 0 && facts.allocatedSeatCount < facts.candidateCount) {
        // Starting with fewer seats than candidates means someone arrives to sit
        // an exam with no desk assigned, which is only discoverable in the room.
        return {
          allowed: false,
          code: 'SEATS_INCOMPLETE',
          message: `${facts.candidateCount - facts.allocatedSeatCount} candidat(s) n'ont pas de place attribuée.`,
        };
      }
      return { allowed: true };

    case 'valuation':
      if (!facts.allExamsFinished) {
        return {
          allowed: false,
          code: 'EXAMS_IN_PROGRESS',
          message: 'Une ou plusieurs épreuves ne sont pas encore terminées.',
        };
      }
      return { allowed: true };

    case 'closed':
      if (facts.pendingMarkCount > 0) {
        return {
          allowed: false,
          code: 'MARKS_PENDING',
          message: `${facts.pendingMarkCount} note(s) restent à saisir.`,
        };
      }
      return { allowed: true };

    case 'setup':
    default:
      return { allowed: true };
  }
}

/** The full check a transition request goes through. */
export function checkTransition(
  from: ExamTermStage,
  to: ExamTermStage,
  facts: ExamTermFacts,
): TransitionCheck {
  const move = isLegalMove(from, to);
  if (!move.allowed) {
    return move;
  }

  // Requirements gate advancing only. Rolling back is the escape hatch that
  // makes the gates safe to enforce in the first place.
  if (stageIndex(to) < stageIndex(from)) {
    return { allowed: true };
  }

  return meetsEntryRequirements(to, facts);
}

/** The next stage, or null at the end of the line. */
export function nextStage(stage: ExamTermStage): ExamTermStage | null {
  return EXAM_TERM_STAGES[stageIndex(stage) + 1] ?? null;
}
