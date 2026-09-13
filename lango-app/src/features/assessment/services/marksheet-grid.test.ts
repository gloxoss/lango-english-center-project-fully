import type { MarkRow } from './marksheet-grid';
import { describe, expect, it } from 'vitest';
import {
  buildSavePayload,
  hasSavableChanges,

  mentionFor,
  nextRowIndex,
  normalizeToTwenty,
  parseMarkInput,
  summarize,
} from './marksheet-grid';

describe('parseMarkInput', () => {
  it('reads a plain score', () => {
    expect(parseMarkInput('14', 20)).toEqual({ kind: 'score', score: 14 });
  });

  it('accepts a comma decimal separator, which is what a French keyboard types', () => {
    expect(parseMarkInput('12,5', 20)).toEqual({ kind: 'score', score: 12.5 });
  });

  it('treats blank as empty, not as zero', () => {
    // The distinction that matters: an unmarked paper must not become a 0.
    expect(parseMarkInput('', 20)).toEqual({ kind: 'empty' });
    expect(parseMarkInput('   ', 20)).toEqual({ kind: 'empty' });
  });

  it('accepts an explicit zero as a real score', () => {
    expect(parseMarkInput('0', 20)).toEqual({ kind: 'score', score: 0 });
  });

  it('maps the single-letter shortcuts, in either case', () => {
    expect(parseMarkInput('a', 20)).toEqual({ kind: 'status', status: 'absent' });
    expect(parseMarkInput('E', 20)).toEqual({ kind: 'status', status: 'exempted' });
    expect(parseMarkInput('r', 20)).toEqual({ kind: 'status', status: 'withheld' });
  });

  it('rejects a score above the paper’s maximum', () => {
    // The classic fat-finger: 155 typed for 15.5.
    const result = parseMarkInput('155', 20);

    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.error).toContain('20');
  });

  it('allows a score exactly at the maximum', () => {
    expect(parseMarkInput('20', 20)).toEqual({ kind: 'score', score: 20 });
  });

  it('respects a non-standard maximum', () => {
    expect(parseMarkInput('35', 40)).toEqual({ kind: 'score', score: 35 });
    expect(parseMarkInput('41', 40).kind).toBe('invalid');
  });

  it('rejects malformed numbers rather than coercing them', () => {
    // Number('12.5.5') is NaN, but Number('') is 0 and Number('1e3') is 1000 —
    // all three would be silently wrong without the pattern check.
    for (const bad of ['12.5.5', '1e3', '--4', '12abc', '-5']) {
      expect(parseMarkInput(bad, 20).kind).toBe('invalid');
    }
  });
});

describe('normalizeToTwenty / mentionFor', () => {
  it('rescales a paper marked out of 40 before qualifying it', () => {
    // 30/40 is 15/20 — "Bien". Unscaled, 30 would qualify as Très Bien.
    expect(normalizeToTwenty(30, 40)).toBe(15);
    expect(mentionFor(30, 40)).toBe('Bien');
  });

  it('applies the Moroccan thresholds on a /20 paper', () => {
    expect(mentionFor(16, 20)).toBe('Très Bien');
    expect(mentionFor(14, 20)).toBe('Bien');
    expect(mentionFor(12, 20)).toBe('Assez Bien');
    expect(mentionFor(10, 20)).toBe('Passable');
    expect(mentionFor(9.99, 20)).toBe('Insuffisant');
  });

  it('returns nothing for an unmarked cell', () => {
    expect(mentionFor(null, 20)).toBeNull();
  });

  it('refuses to divide by a zero maximum', () => {
    expect(normalizeToTwenty(10, 0)).toBeNull();
    expect(mentionFor(10, 0)).toBeNull();
  });
});

describe('nextRowIndex', () => {
  it('moves down on Enter, Tab and ArrowDown', () => {
    expect(nextRowIndex(0, 'Enter', 5)).toBe(1);
    expect(nextRowIndex(0, 'Tab', 5)).toBe(1);
    expect(nextRowIndex(0, 'ArrowDown', 5)).toBe(1);
  });

  it('moves up on ArrowUp and Shift+Tab', () => {
    expect(nextRowIndex(3, 'ArrowUp', 5)).toBe(2);
    expect(nextRowIndex(3, 'ShiftTab', 5)).toBe(2);
  });

  it('wraps at both ends instead of trapping focus', () => {
    expect(nextRowIndex(4, 'Enter', 5)).toBe(0);
    expect(nextRowIndex(0, 'ArrowUp', 5)).toBe(4);
  });

  it('returns null for an empty roster', () => {
    expect(nextRowIndex(0, 'Enter', 0)).toBeNull();
  });
});

function row(overrides: Partial<MarkRow> = {}): MarkRow {
  return { studentId: `s-${Math.random()}`, input: '', status: 'graded', ...overrides };
}

describe('summarize', () => {
  it('counts each cell into exactly one bucket', () => {
    const summary = summarize([
      row({ input: '15' }),
      row({ input: '8' }),
      row({ input: '' }),
      row({ status: 'absent' }),
      row({ status: 'exempted' }),
      row({ status: 'withheld' }),
      row({ input: '999' }),
    ], 20, 10);

    expect(summary.gradedCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.absentCount).toBe(1);
    expect(summary.exemptedCount).toBe(1);
    expect(summary.withheldCount).toBe(1);
    expect(summary.invalidCount).toBe(1);
  });

  it('excludes absences from the average rather than scoring them zero', () => {
    // With absences counted as 0 this average would be 6, understating a class
    // that in fact averaged 12.
    const summary = summarize([
      row({ input: '12' }),
      row({ input: '12' }),
      row({ status: 'absent' }),
      row({ status: 'absent' }),
    ], 20, 10);

    expect(summary.average).toBe(12);
  });

  it('excludes blank rows from the average too', () => {
    const summary = summarize([row({ input: '16' }), row({ input: '' })], 20, 10);

    expect(summary.average).toBe(16);
  });

  it('computes the pass rate over graded students only', () => {
    const summary = summarize([
      row({ input: '12' }),
      row({ input: '10' }),
      row({ input: '4' }),
      row({ status: 'absent' }),
    ], 20, 10);

    // 2 of 3 graded are at or above the pass mark of 10.
    expect(summary.passRate).toBe(67);
  });

  it('reports null rather than NaN when nothing is graded yet', () => {
    const summary = summarize([row(), row({ status: 'absent' })], 20, 10);

    expect(summary.average).toBeNull();
    expect(summary.passRate).toBeNull();
  });
});

describe('buildSavePayload', () => {
  it('omits blank rows so an unread paper is never published as a zero', () => {
    const payload = buildSavePayload([
      row({ studentId: 'a', input: '15' }),
      row({ studentId: 'b', input: '' }),
    ], 20);

    expect(payload).toEqual([{ studentId: 'a', rawScore: 15, status: 'graded' }]);
  });

  it('omits invalid rows rather than sending a coerced value', () => {
    const payload = buildSavePayload([row({ studentId: 'a', input: '155' })], 20);

    expect(payload).toEqual([]);
  });

  it('sends a status row with no score attached', () => {
    const payload = buildSavePayload([row({ studentId: 'a', status: 'absent', input: '' })], 20);

    expect(payload).toEqual([{ studentId: 'a', status: 'absent' }]);
  });

  it('sends a status row even when a stale score is still in the cell', () => {
    // Belt and braces: the UI clears the input on a status change, but the
    // payload must not carry a score for an absent student regardless.
    const payload = buildSavePayload([row({ studentId: 'a', status: 'absent', input: '15' })], 20);

    expect(payload).toEqual([{ studentId: 'a', status: 'absent' }]);
  });

  it('converts a comma-typed score', () => {
    const payload = buildSavePayload([row({ studentId: 'a', input: '12,5' })], 20);

    expect(payload).toEqual([{ studentId: 'a', rawScore: 12.5, status: 'graded' }]);
  });
});

describe('hasSavableChanges', () => {
  it('is false for an untouched grid', () => {
    expect(hasSavableChanges([row(), row()], 20)).toBe(false);
  });

  it('is true once one mark is entered', () => {
    expect(hasSavableChanges([row(), row({ input: '11' })], 20)).toBe(true);
  });
});
