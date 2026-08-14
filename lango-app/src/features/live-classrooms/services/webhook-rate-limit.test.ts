// Pure unit tests (no DB) for the P1-4 webhook failure-rate limiter.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  isWebhookRateLimited, recordFailedWebhookAttempt, resetWebhookRateLimitForTest,
  WEBHOOK_RATE_LIMIT,
} from './webhook-rate-limit';

describe('webhook rate limit (P1-4)', () => {
  beforeEach(() => resetWebhookRateLimitForTest());

  it('does not block a key with no recorded failures', () => {
    expect(isWebhookRateLimited('1.2.3.4')).toBe(false);
  });

  it('does not block below the failure budget, blocks once the budget is reached', () => {
    const now = 1_000_000;
    for (let i = 0; i < WEBHOOK_RATE_LIMIT.maxFailuresPerWindow - 1; i++) {
      recordFailedWebhookAttempt('1.2.3.4', now + i);
    }
    expect(isWebhookRateLimited('1.2.3.4', now)).toBe(false); // one under budget
    recordFailedWebhookAttempt('1.2.3.4', now); // reaches the budget
    expect(isWebhookRateLimited('1.2.3.4', now)).toBe(true);
  });

  it('does not block a DIFFERENT key even if one key is exhausted', () => {
    const now = 2_000_000;
    for (let i = 0; i <= WEBHOOK_RATE_LIMIT.maxFailuresPerWindow; i++) {
      recordFailedWebhookAttempt('attacker-ip', now + i);
    }
    expect(isWebhookRateLimited('attacker-ip', now)).toBe(true);
    expect(isWebhookRateLimited('legit-provider-ip', now)).toBe(false);
  });

  it('resets once the window elapses', () => {
    const now = 3_000_000;
    for (let i = 0; i <= WEBHOOK_RATE_LIMIT.maxFailuresPerWindow; i++) {
      recordFailedWebhookAttempt('1.2.3.4', now + i);
    }
    expect(isWebhookRateLimited('1.2.3.4', now)).toBe(true);
    const afterWindow = now + WEBHOOK_RATE_LIMIT.windowMs + 1;
    expect(isWebhookRateLimited('1.2.3.4', afterWindow)).toBe(false);
    // A fresh window starts counting from zero again.
    recordFailedWebhookAttempt('1.2.3.4', afterWindow);
    expect(isWebhookRateLimited('1.2.3.4', afterWindow)).toBe(false);
  });
});
