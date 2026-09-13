import type { MentionType } from '@/libs/grading/moroccan-grade-engine';
import { getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';

/**
 * Cell parsing and keyboard navigation for the marksheet grid.
 *
 * Deliberately free of React and of the database: a teacher entering 200 marks
 * is doing the same three things over and over (type a number, flag an absence,
 * move down), and those three things are worth testing directly rather than
 * through a rendered grid.
 */

export type MarkStatus = 'graded' | 'exempted' | 'absent' | 'withheld';

/** Single-letter shortcuts, so a hand never leaves the number pad. */
export const STATUS_SHORTCUTS: Record<string, MarkStatus> = {
  a: 'absent',
  e: 'exempted',
  r: 'withheld',
};

export const STATUS_LABELS: Record<MarkStatus, string> = {
  graded: 'Noté',
  exempted: 'Dispensé',
  absent: 'Absent',
  withheld: 'Retenu',
};

export type ParsedCell
  = | { kind: 'empty' }
    | { kind: 'score'; score: number }
    | { kind: 'status'; status: MarkStatus }
    | { kind: 'invalid'; error: string };

/**
 * Parses one cell's raw text.
 *
 * Accepts a comma decimal separator because that is what a French/Arabic
 * keyboard layout produces, and a teacher typing "12,5" means 12.5, not a
 * validation error.
 */
export function parseMarkInput(raw: string, maximumScore: number): ParsedCell {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { kind: 'empty' };
  }

  const shortcut = STATUS_SHORTCUTS[trimmed.toLowerCase()];
  if (shortcut) {
    return { kind: 'status', status: shortcut };
  }

  const normalized = trimmed.replace(',', '.');

  // Rejects "12.5.5", "1e3", "--4" and stray letters that are not shortcuts.
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { kind: 'invalid', error: 'Saisie non reconnue. Entrez une note, ou A / E / R.' };
  }

  const score = Number(normalized);

  if (!Number.isFinite(score)) {
    return { kind: 'invalid', error: 'Saisie non reconnue.' };
  }

  if (score > maximumScore) {
    // The common fat-finger error: 155 for 15.5 on a /20 paper. Catching it at
    // entry matters because a score above the maximum silently skews an average.
    return { kind: 'invalid', error: `La note ne peut pas dépasser ${maximumScore}.` };
  }

  return { kind: 'score', score };
}

/**
 * Rescales a raw score onto /20, the scale every Moroccan mention is defined on.
 * A paper marked out of 40 must not be handed to getMoroccanMention unscaled.
 */
export function normalizeToTwenty(score: number, maximumScore: number): number | null {
  if (maximumScore <= 0) {
    return null;
  }
  return (score / maximumScore) * 20;
}

/** The live mention for one cell, or null when there is nothing to qualify. */
export function mentionFor(score: number | null, maximumScore: number): MentionType | null {
  if (score === null) {
    return null;
  }
  const outOfTwenty = normalizeToTwenty(score, maximumScore);
  return outOfTwenty === null ? null : getMoroccanMention(outOfTwenty);
}

export type NavigationKey = 'Enter' | 'ArrowDown' | 'ArrowUp' | 'Tab' | 'ShiftTab';

/**
 * Where the caret goes next.
 *
 * Down-and-wrap is the whole point of the grid: Enter on the last row returns to
 * the first rather than trapping focus, so a teacher can correct a row they
 * skipped without reaching for the mouse. Returns null when there is nowhere to
 * go (an empty roster).
 */
export function nextRowIndex(current: number, key: NavigationKey, rowCount: number): number | null {
  if (rowCount <= 0) {
    return null;
  }

  const forward = key === 'Enter' || key === 'ArrowDown' || key === 'Tab';
  const delta = forward ? 1 : -1;

  return (current + delta + rowCount) % rowCount;
}

export type MarkRow = {
  studentId: string;
  /** Raw cell text as typed, so an invalid entry is not silently discarded. */
  input: string;
  status: MarkStatus;
};

export type GridSummary = {
  /** Cells holding a usable score. */
  gradedCount: number;
  absentCount: number;
  exemptedCount: number;
  withheldCount: number;
  /** Rows still blank — what is left to do. */
  pendingCount: number;
  invalidCount: number;
  /** Mean of graded scores on the paper's own scale, or null if none yet. */
  average: number | null;
  /** Graded students at or above the pass mark, as a percentage. */
  passRate: number | null;
};

/**
 * Live totals for the grid footer.
 *
 * Absent and exempted students are excluded from the average, not counted as
 * zero: averaging in an absence would understate a class's real performance,
 * which is the figure a head teacher acts on.
 */
export function summarize(rows: MarkRow[], maximumScore: number, passMark: number): GridSummary {
  let gradedCount = 0;
  let absentCount = 0;
  let exemptedCount = 0;
  let withheldCount = 0;
  let pendingCount = 0;
  let invalidCount = 0;
  let scoreTotal = 0;
  let passCount = 0;

  for (const row of rows) {
    if (row.status === 'absent') {
      absentCount += 1;
      continue;
    }
    if (row.status === 'exempted') {
      exemptedCount += 1;
      continue;
    }
    if (row.status === 'withheld') {
      withheldCount += 1;
      continue;
    }

    const parsed = parseMarkInput(row.input, maximumScore);

    if (parsed.kind === 'empty') {
      pendingCount += 1;
    } else if (parsed.kind === 'invalid') {
      invalidCount += 1;
    } else if (parsed.kind === 'score') {
      gradedCount += 1;
      scoreTotal += parsed.score;
      if (parsed.score >= passMark) {
        passCount += 1;
      }
    }
  }

  return {
    gradedCount,
    absentCount,
    exemptedCount,
    withheldCount,
    pendingCount,
    invalidCount,
    average: gradedCount === 0 ? null : scoreTotal / gradedCount,
    passRate: gradedCount === 0 ? null : Math.round((passCount / gradedCount) * 100),
  };
}

export type MarkPayloadItem = {
  studentId: string;
  rawScore?: number;
  status: MarkStatus;
};

/**
 * Turns grid state into the POST body.
 *
 * Blank rows are omitted rather than sent as 0 — a mark nobody has entered yet
 * is not a zero, and sending one would publish a failing grade for a student
 * whose paper has not been read.
 */
export function buildSavePayload(rows: MarkRow[], maximumScore: number): MarkPayloadItem[] {
  const payload: MarkPayloadItem[] = [];

  for (const row of rows) {
    if (row.status !== 'graded') {
      payload.push({ studentId: row.studentId, status: row.status });
      continue;
    }

    const parsed = parseMarkInput(row.input, maximumScore);
    if (parsed.kind === 'score') {
      payload.push({ studentId: row.studentId, rawScore: parsed.score, status: 'graded' });
    }
  }

  return payload;
}

/** True when there is something worth enabling the Save button for. */
export function hasSavableChanges(rows: MarkRow[], maximumScore: number): boolean {
  return buildSavePayload(rows, maximumScore).length > 0;
}
