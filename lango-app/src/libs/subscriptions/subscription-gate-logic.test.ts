import { describe, expect, it } from 'vitest';
import { isSubscriptionBlocked } from './subscription-gate-logic';

describe('isSubscriptionBlocked', () => {
  it.each(['past_due', 'unpaid', 'canceled', 'suspended', 'cancelled'])(
    'returns true for blocked status "%s"',
    (status) => {
      expect(isSubscriptionBlocked(status)).toBe(true);
    },
  );

  it.each(['active', 'trialing', 'some_unknown_status'])(
    'returns false for non-blocked status "%s"',
    (status) => {
      expect(isSubscriptionBlocked(status)).toBe(false);
    },
  );

  it('returns false for null', () => {
    expect(isSubscriptionBlocked(null)).toBe(false);
  });
});
