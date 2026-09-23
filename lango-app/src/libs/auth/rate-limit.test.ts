import { describe, expect, it } from 'vitest';
import { AUTH_RATE_LIMIT_CUSTOM_RULES } from '@/libs/auth/rate-limit';

describe('authentication rate limit rules', () => {
  it('does not consume the IP budget for repeated session reads', () => {
    expect(AUTH_RATE_LIMIT_CUSTOM_RULES['/get-session']).toBe(false);
  });

  it('keeps a bounded email sign-in rule', () => {
    expect(AUTH_RATE_LIMIT_CUSTOM_RULES['/sign-in/email']).toEqual({
      window: 60,
      max: 30,
    });
  });
});
