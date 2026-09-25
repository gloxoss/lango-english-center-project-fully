import { describe, expect, it } from 'vitest';
import { classifyPeriod1Mark, occurrenceAt } from '@/libs/attendance/period1-audit';

// The rule that decides whether a QR mark stored on period 1 was really that
// lesson. Driven by the report script, so the interesting cases are the ones
// where a careless implementation would blame the wrong lesson.

// A normal Moroccan morning: five lessons, adjacent, with the afternoon one far
// from the rest. Register windows are start - 5 min .. end + 15 min, so lessons
// 1 and 2 have OVERLAPPING windows (07:55-09:10 and 08:55-10:10).
const DAY = [
  { period: 1, startTime: '08:00', endTime: '08:55' },
  { period: 2, startTime: '09:00', endTime: '09:55' },
  { period: 3, startTime: '10:00', endTime: '10:55' },
  { period: 4, startTime: '11:00', endTime: '11:55' },
  { period: 5, startTime: '14:00', endTime: '14:55' },
];

const at = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

describe('period-1 mark classification', () => {
  it('calls a 14:10 scan corrupt and names the real lesson', () => {
    // The reported bug: this was stored on period 1, the 08:00 lesson.
    expect(classifyPeriod1Mark(at('14:10'), DAY, 1)).toEqual({
      verdict: 'CORRUPTED',
      foundPeriod: 5,
    });
  });

  it('leaves a scan that really was period 1 alone', () => {
    expect(classifyPeriod1Mark(at('08:10'), DAY, 1)).toEqual({
      verdict: 'OK_PERIOD_1',
      foundPeriod: 1,
    });
  });

  it('reports a scan in the gap between lessons as undecidable, not corrupt', () => {
    // 11:55 + 15 min closes period 4 at 12:10; the next lesson opens at 13:55.
    expect(classifyPeriod1Mark(at('12:30'), DAY, 1)).toEqual({
      verdict: 'UNDECIDABLE',
      foundPeriod: null,
    });
  });

  it('prefers the lesson in session over an earlier lesson whose window still covers it', () => {
    // 09:00 is inside period 2 (in session) AND period 1's window (ends 09:10).
    // Taking the first window match would file this under the lesson that had
    // already finished 5 minutes earlier.
    expect(classifyPeriod1Mark(at('09:00'), DAY, 1)).toEqual({
      verdict: 'CORRUPTED',
      foundPeriod: 2,
    });
  });

  it('falls back to the window for a scan just after a lesson ends', () => {
    // 08:57: period 1 is over, period 2 has not started. The grace window is the
    // only thing that can place it, and it places it on period 1.
    expect(classifyPeriod1Mark(at('08:57'), DAY, 1)).toEqual({
      verdict: 'OK_PERIOD_1',
      foundPeriod: 1,
    });
  });

  it('is undecidable when there is no timetable to judge against', () => {
    expect(classifyPeriod1Mark(at('10:30'), [], 1)).toEqual({
      verdict: 'UNDECIDABLE',
      foundPeriod: null,
    });
  });

  it('accepts a boundary minute at each end of the window', () => {
    expect(occurrenceAt(at('07:55'), DAY)?.period).toBe(1);
    expect(occurrenceAt(at('15:10'), DAY)?.period).toBe(5);
    expect(occurrenceAt(at('07:54'), DAY)).toBeUndefined();
    expect(occurrenceAt(at('15:11'), DAY)).toBeUndefined();
  });

  it('does not treat a different stored period as period-1 corruption', () => {
    // Guards the rule against being read as "always corrupt": a row stored on 5
    // and scanned during 5 agrees with itself.
    expect(classifyPeriod1Mark(at('14:10'), DAY, 5)).toEqual({
      verdict: 'OK_PERIOD_1',
      foundPeriod: 5,
    });
  });
});
