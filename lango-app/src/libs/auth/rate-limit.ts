import type { BetterAuthRateLimitOptions } from '@better-auth/core';

/**
 * Session reads happen on every protected page and do not authenticate a user.
 * Exempting that read path keeps shared campus IPs from exhausting the
 * login budget while the sign-in rule remains intentionally tight.
 */
export const AUTH_RATE_LIMIT_CUSTOM_RULES = {
  '/get-session': false,
  '/sign-in/email': { window: 60, max: 30 },
} satisfies NonNullable<BetterAuthRateLimitOptions['customRules']>;
