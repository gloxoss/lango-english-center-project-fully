import { describe, expect, it } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import { ALLOWED_TRANSITIONS, assertTransition, type DraftStatus } from '../services/drafts-service';

const ALL: DraftStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'applied', 'cancelled'];

describe('drafts state machine', () => {
  it('only allows the documented lifecycle transitions', () => {
    expect(ALLOWED_TRANSITIONS).toEqual({
      draft: ['submitted', 'cancelled'],
      submitted: ['approved', 'rejected'],
      approved: ['applied'],
      rejected: [],
      applied: [],
      cancelled: [],
    });
  });

  it('accepts each legal transition', () => {
    expect(() => assertTransition('draft', 'submitted', 'submit')).not.toThrow();
    expect(() => assertTransition('draft', 'cancelled', 'cancel')).not.toThrow();
    expect(() => assertTransition('submitted', 'approved', 'approve')).not.toThrow();
    expect(() => assertTransition('submitted', 'rejected', 'reject')).not.toThrow();
    expect(() => assertTransition('approved', 'applied', 'apply')).not.toThrow();
  });

  it.each(ALL.flatMap(from => ALL.filter(to => !ALLOWED_TRANSITIONS[from].includes(to)).map(to => [from, to])))(
    'rejects %s → %s',
    (from, to) => {
      try {
        assertTransition(from as DraftStatus, to as DraftStatus, 'test');
        expect.unreachable(`expected ${from} → ${to} to throw`);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('INVALID_TRANSITION');
        expect((err as ApiError).status).toBe(409);
      }
    },
  );

  it('cannot skip the submission gate (draft → approved directly)', () => {
    expect(() => assertTransition('draft', 'approved', 'approve')).toThrow(ApiError);
  });

  it('terminal states reject every further move', () => {
    for (const terminal of ['rejected', 'applied', 'cancelled'] as const) {
      for (const to of ALL) {
        expect(() => assertTransition(terminal, to, 'test')).toThrow(ApiError);
      }
    }
  });
});
