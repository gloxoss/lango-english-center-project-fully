import { describe, expect, it, vi } from 'vitest';
import {
  CAPACITY_BELOW_OCCUPANCY,
  CAPACITY_EXCEEDED,
  CAPACITY_NOT_CONFIGURED,
  evaluateCapacity,
  exceedsCapacity,
} from '@/libs/services/section-capacity';

// One capacity truth: `class_sections.maxStudents` is the only field allowed to
// decide whether a seat exists. Missing capacity must never silently default to
// 30/32/35 — it is an explicit "not configured" state the operator must fix.

vi.mock('@/libs/DB', () => ({ db: {} }));

describe('section capacity — single truth arithmetic', () => {
  it('reports an unconfigured capacity instead of inventing a default', () => {
    for (const value of [null, undefined]) {
      const evaluated = evaluateCapacity(value, 0);

      expect(evaluated.configured).toBe(false);
      expect(evaluated.available).toBeNull();
      expect(evaluated.allowsOneMore).toBe(false);
    }
  });

  it('does not flag an unconfigured section as exceeding capacity', () => {
    expect(exceedsCapacity(null, 999)).toBe(false);
    expect(exceedsCapacity(undefined, 999)).toBe(false);
  });

  it('computes the remaining seats for a partially filled section', () => {
    const evaluated = evaluateCapacity(30, 29);

    expect(evaluated.configured).toBe(true);
    expect(evaluated.available).toBe(1);
    expect(evaluated.allowsOneMore).toBe(true);
  });

  it('refuses one more seat on an exactly full section', () => {
    const evaluated = evaluateCapacity(30, 30);

    expect(evaluated.available).toBe(0);
    expect(evaluated.allowsOneMore).toBe(false);
  });

  it('clamps available seats to zero when occupancy is already over the maximum', () => {
    const evaluated = evaluateCapacity(30, 32);

    expect(evaluated.available).toBe(0);
    expect(evaluated.allowsOneMore).toBe(false);
    expect(exceedsCapacity(30, 32)).toBe(true);
  });

  it('treats a zero maximum as configured-but-closed', () => {
    const evaluated = evaluateCapacity(0, 0);

    expect(evaluated.configured).toBe(true);
    expect(evaluated.available).toBe(0);
    expect(evaluated.allowsOneMore).toBe(false);
  });

  it('never lets occupancy below maximum count as exceeding', () => {
    expect(exceedsCapacity(30, 29)).toBe(false);
    expect(exceedsCapacity(30, 30)).toBe(false);
  });

  it('pins the API error codes used by every operational path', () => {
    expect(CAPACITY_NOT_CONFIGURED).toBe('CAPACITY_NOT_CONFIGURED');
    expect(CAPACITY_EXCEEDED).toBe('CAPACITY_EXCEEDED');
    expect(CAPACITY_BELOW_OCCUPANCY).toBe('CAPACITY_BELOW_OCCUPANCY');
  });
});
