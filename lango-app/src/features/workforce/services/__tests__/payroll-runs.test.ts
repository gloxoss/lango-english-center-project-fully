import { describe, expect, it } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import {
  assertTransition,
  canTransition,
  isRecalculatable,
  RunStatus,
} from '../payroll-runs';

const ALL_STATUSES: RunStatus[] = [
  'draft', 'calculating', 'calculated', 'under_review', 'approved',
  'posted', 'paid', 'closed', 'failed', 'cancelled', 'reversed',
];

describe('payroll lifecycle state machine (pure)', () => {
  it('walks the happy path draft→calculating→calculated→under_review→approved→posted→paid→closed', () => {
    const path: RunStatus[] = [
      'draft', 'calculating', 'calculated', 'under_review', 'approved',
      'posted', 'paid', 'closed',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i]!;
      const to = path[i + 1]!;
      expect(canTransition(from, to), `${from}→${to}`).toBe(true);
    }
  });

  it('rejects every disallowed edge', () => {
    const allowed = new Map<RunStatus, Set<RunStatus>>([
      ['draft', new Set(['calculating', 'cancelled', 'failed'])],
      ['calculating', new Set(['calculated', 'failed', 'cancelled'])],
      ['calculated', new Set(['calculating', 'under_review', 'approved', 'cancelled', 'failed'])],
      ['under_review', new Set(['approved', 'calculating', 'cancelled'])],
      ['approved', new Set(['posted', 'cancelled'])],
      ['posted', new Set(['paid', 'reversed'])],
      ['paid', new Set(['closed', 'reversed'])],
      ['closed', new Set()],
      ['failed', new Set(['calculating', 'cancelled'])],
      ['cancelled', new Set()],
      ['reversed', new Set()],
    ]);
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expectAllowed = allowed.get(from)?.has(to) ?? false;
        expect(canTransition(from, to), `${from}→${to}`).toBe(expectAllowed);
      }
    }
  });

  it('assertTransition throws PAYROLL_INVALID_TRANSITION on an illegal edge', () => {
    expect(() => assertTransition('draft', 'approved')).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_INVALID_TRANSITION' }),
    );
    expect(() => assertTransition('closed', 'paid')).toThrowError(ApiError);
    expect(() => assertTransition('cancelled', 'calculating')).toThrowError(ApiError);
    expect(() => assertTransition('reversed', 'posted')).toThrowError(ApiError);
  });

  it('assertTransition is a no-op on a legal edge', () => {
    expect(() => assertTransition('calculated', 'under_review')).not.toThrow();
    expect(() => assertTransition('posted', 'paid')).not.toThrow();
    expect(() => assertTransition('approved', 'posted')).not.toThrow();
  });

  it('isRecalculatable is true only before approval', () => {
    for (const s of ALL_STATUSES) {
      const expectRecalc = ['draft', 'calculating', 'calculated', 'under_review', 'failed'].includes(s);
      expect(isRecalculatable(s), s).toBe(expectRecalc);
    }
  });

  it('a cancelled/failed run can restart calculation but an approved one cannot', () => {
    expect(canTransition('failed', 'calculating')).toBe(true);
    expect(canTransition('cancelled', 'calculating')).toBe(false);
    expect(canTransition('approved', 'calculating')).toBe(false);
    expect(canTransition('approved', 'under_review')).toBe(false);
  });
});
