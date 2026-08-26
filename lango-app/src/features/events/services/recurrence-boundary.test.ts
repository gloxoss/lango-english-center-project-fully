// Recurrence expansion boundary cases for buildOccurrenceRows — the pure function
// shared by createEvent and the materialization endpoint. Proves the date-semantic
// recurrence-end comparison (the fix that excluded the final occurrence when an
// exact-instant boundary check was used), interval spacing, and the hard cap.
import { describe, expect, it } from 'vitest';
import { buildOccurrenceRows } from './event-operations-service';

const T = 'tenant';
const E = 'event';

describe('buildOccurrenceRows recurrence boundaries', () => {
  it('emits exactly one occurrence for a non-recurring schedule', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-none', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.originalDate).toBe('2026-01-01');
    expect(rows[0]!.startTime).toBe('2026-01-01T10:00:00Z');
  });

  it('includes the occurrence ON the recurrence end date (date-semantic boundary)', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-daily', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z',
      recurrenceRule: 'daily', recurrenceEndDate: '2026-01-03',
    });
    expect(rows.map(r => r.originalDate)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('spaces weekly occurrences by seven days', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-weekly', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z',
      recurrenceRule: 'weekly', recurrenceEndDate: '2026-01-16',
    });
    expect(rows.map(r => r.originalDate)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15']);
  });

  it('advances monthly occurrences one calendar month (mid-month, no drift)', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-monthly', startTime: '2026-01-15T10:00:00Z', endTime: '2026-01-15T11:00:00Z',
      recurrenceRule: 'monthly', recurrenceEndDate: '2026-03-15',
    });
    expect(rows.map(r => r.originalDate)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('preserves the schedule duration across every occurrence', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-dur', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:30:00Z',
      recurrenceRule: 'daily', recurrenceEndDate: '2026-01-03',
    });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(new Date(r.endTime).getTime() - new Date(r.startTime).getTime()).toBe(90 * 60_000);
    }
  });

  it('caps an unbounded series at the maximum occurrence count', () => {
    const rows = buildOccurrenceRows(T, E, {
      id: 's-unbounded', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z',
      recurrenceRule: 'daily',
    });
    expect(rows).toHaveLength(366);
  });
});
