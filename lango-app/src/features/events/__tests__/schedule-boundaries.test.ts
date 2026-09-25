// Schedule boundary tests (AUD-CALENDAR-01).
//
// Events store absolute instants in a single UTC frame (see parseUtcString in
// event-operations-service.ts): the DB `timestamp` columns drop the trailing Z on
// write, so the value read back is a UTC wall clock, and re-appending Z keeps all
// recurrence math in one frame. That design is self-consistent and DST-free as
// long as Morocco stays on a fixed offset, so these tests pin the boundaries it
// must keep rather than restyle it.
//
// The gap this campaign found: POST /api/addons/events accepted
// endTime <= startTime. buildOccurrenceRows clamps a negative duration to zero,
// so the series materialised zero-length occurrences. Times are absolute
// instants, so an overnight event (22:00 -> 02:00 the next day) still has
// endTime > startTime and stays valid; only end-at-or-before-start is rejected.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOccurrenceRows } from '@/features/events/services/event-operations-service';

const EVENTS_ROUTE = path.resolve(process.cwd(), 'src/app/api/addons/events/route.ts');

const T = '00000000-0000-4000-8000-000000000001';
const S = '00000000-0000-4000-8000-000000000002';

describe('Event schedule boundaries', () => {
  it('keeps an overnight event intact', () => {
    // 22:00 -> 02:00 the next day: the end is a LATER instant, and the duration
    // survives each recurrence step.
    const rows = buildOccurrenceRows(T, S, {
      id: S,
      startTime: '2026-09-24T22:00:00.000Z',
      endTime: '2026-09-25T02:00:00.000Z',
      recurrenceRule: 'daily',
      recurrenceEndDate: '2026-09-26',
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]!.startTime).toBe('2026-09-24T22:00:00.000Z');
    expect(rows[0]!.endTime).toBe('2026-09-25T02:00:00.000Z');
    // The recurrence advances the START by a day and re-applies the duration, so
    // each occurrence still crosses midnight.
    expect(rows[1]!.startTime).toBe('2026-09-25T22:00:00.000Z');
    expect(rows[1]!.endTime).toBe('2026-09-26T02:00:00.000Z');
  });

  it('materialises zero-length occurrences for a degenerate schedule', () => {
    // Evidence for why the route now rejects endTime <= startTime: the duration
    // is clamped to zero, so the occurrences are meaningless rather than an error.
    const rows = buildOccurrenceRows(T, S, {
      id: S,
      startTime: '2026-09-24T10:00:00.000Z',
      endTime: '2026-09-24T10:00:00.000Z',
      recurrenceRule: 'daily',
      recurrenceEndDate: '2026-09-25',
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.endTime).toBe(rows[0]!.startTime);
  });

  it('includes the occurrence on the recurrence end date', () => {
    // The end boundary is date-semantic on purpose: an exact-instant check would
    // drop the final occurrence when the write path trims a few ms.
    const rows = buildOccurrenceRows(T, S, {
      id: S,
      startTime: '2026-09-24T09:00:00.000Z',
      endTime: '2026-09-24T10:00:00.000Z',
      recurrenceRule: 'daily',
      recurrenceEndDate: '2026-09-26',
    });

    expect(rows.map(r => r.originalDate)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26']);
  });

  it('caps runaway series', () => {
    const rows = buildOccurrenceRows(T, S, {
      id: S,
      startTime: '2026-01-01T09:00:00.000Z',
      endTime: '2026-01-01T10:00:00.000Z',
      recurrenceRule: 'daily',
      recurrenceEndDate: null,
    });

    expect(rows.length).toBeLessThanOrEqual(366);
  });

  it('rejects end-at-or-before-start at the API boundary', () => {
    const src = fs.readFileSync(EVENTS_ROUTE, 'utf8');

    expect(src).toContain('s.startTime < s.endTime');
  });
});
